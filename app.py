from flask import Flask, render_template, request, jsonify, redirect, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import ollama
import json
import urllib.request
import urllib.error
import urllib.parse
import uuid
import os


app = Flask(__name__)

app.secret_key = "bezagpt_secret_key"


database_url = os.getenv("DATABASE_URL")
if not database_url:
    database_url = "sqlite:////tmp/bezagpt.db" if os.getenv("VERCEL") else "sqlite:///bezagpt.db"

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False


ollama_api_key = os.getenv("OLLAMA_API_KEY")
ollama_host = os.getenv("OLLAMA_HOST") or "http://127.0.0.1:11434"

ollama_model = os.getenv(
    "OLLAMA_MODEL",
    "qwen3-coder:480b-cloud" if os.getenv("VERCEL") else "qwen2.5-coder:3b"
)

ollama_headers = {}
if ollama_api_key:
    ollama_headers["Authorization"] = "Bearer " + ollama_api_key

ollama_client = ollama.Client(
    host=ollama_host,
    headers=ollama_headers or None
)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")


db = SQLAlchemy(app)

SYSTEM_PROMPT = """
You are Lucas, a smart and friendly AI assistant.

IDENTITY RULE (very important):
- ONLY if the user asks who you are, what your name is, or asks you
  to introduce yourself, reply exactly with this text and no quotation marks:
I am Lucas, an AI designed to assist with information and tasks
through language processing. I was created by Beza Abera, a software
developer with expertise in artificial intelligence and machine
learning. My purpose is to provide accurate and helpful responses to
the best of my abilities based on the input provided. How can I
assist you today?
- If the user message is about anything else, NEVER introduce
  yourself, NEVER say "I am Lucas" and NEVER repeat the text above.
  Just answer the request directly and helpfully without mentioning
  who you are.

Never say your name is anything else. Never mention BezaGPT,
Ollama, Qwen or any other model or company as yourself.

You are great at writing, explaining and debugging code in any
programming language, explaining difficult topics simply, and
helping with school.

You CAN create images: when the user asks for one, the app generates
it automatically. Never say that you cannot create images.

Be helpful, professional and friendly.
"""




# ================= DATABASE =================


class User(db.Model):

    id = db.Column(db.Integer, primary_key=True)

    username = db.Column(db.String(100), unique=True)

    password = db.Column(db.String(200))

    email = db.Column(db.String(200), unique=True)

    display_name = db.Column(db.String(200))



class Chat(db.Model):

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer)

    title = db.Column(db.String(200))

    created_at = db.Column(db.String(100))



class Message(db.Model):

    id = db.Column(db.Integer, primary_key=True)

    chat_id = db.Column(db.Integer)

    role = db.Column(db.String(50))

    content = db.Column(db.Text)





# ================= PAGES =================


@app.route("/")
def home():

    if "user_id" not in session:
        return redirect("/login")

    user = User.query.get(session["user_id"])
    if not user:
        session.clear()
        return redirect("/login")

    return render_template("index.html", current_user=user)


@app.route("/settings")
@app.route("/settings/<section>")
def settings_page(section=None):

    if "user_id" not in session:
        return redirect("/login")

    user = User.query.get(session["user_id"])
    if not user:
        session.clear()
        return redirect("/login")

    valid_sections = [
        "general",
        "appearance",
        "personalization",
        "pets",
        "voice",
        "billing",
        "usage",
        "account",
        "plugins",
        "browser",
        "coding",
        "hooks",
        "connections",
        "git",
        "environments",
        "worktrees"
    ]

    selected = section if section in valid_sections else "general"

    return render_template(
        "settings.html",
        current_user=user,
        section=selected,
        sections=valid_sections
    )


# ================= REGISTER =================


@app.route("/register", methods=["GET","POST"])
def register():

    if request.method == "POST":

        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        if not username or not email or not password:
            return "Please complete all fields"

        if User.query.filter_by(email=email).first():
            return "Email already registered"

        if User.query.filter_by(username=username).first():
            return "Username already taken"

        hashed_password = generate_password_hash(password)

        user = User(
            username=username,
            email=email,
            password=hashed_password,
            display_name=username
        )

        try:
            db.session.add(user)
            db.session.commit()
            session["user_id"] = user.id
            return redirect("/")
        except Exception as e:
            db.session.rollback()
            return str(e)

    return render_template("register.html")





# ================= LOGIN =================


@app.route("/login", methods=["GET","POST"])
def login():

    if request.method == "POST":

        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        user = User.query.filter_by(email=email).first()

        if not user:
            user = User.query.filter_by(username=email).first()

        if user and check_password_hash(user.password, password):
            session["user_id"] = user.id
            return redirect("/")

        return "Wrong email or password"

    return render_template("login.html")





# ================= LOGOUT =================


@app.route("/logout")
def logout():

    session.clear()

    return redirect("/login")





# ================= NEW CHAT =================


@app.route("/new_chat", methods=["POST"])
def new_chat():


    chat = Chat(

        user_id=session["user_id"],

        title="New Chat",

        created_at=datetime.now().isoformat()

    )


    db.session.add(chat)

    db.session.commit()



    return jsonify({

        "id":chat.id

    })






# ================= CHAT =================


def get_fallback_reply(text):
    cleaned = (text or "").strip()
    if not cleaned:
        return "I’m here and ready to help."

    return (
        "Ollama is not running or not installed on this machine, so I’m using a local fallback reply. "
        "Please install Ollama and start it at http://127.0.0.1:11434 to enable full model responses.\n\n"
        f"Your request: {cleaned}"
    )


def ask_model(text, system_prompt=SYSTEM_PROMPT):
    if DEEPSEEK_API_KEY:
        try:
            payload = {
                "model": DEEPSEEK_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                "temperature": 0.7,
                "stream": False
            }

            req = urllib.request.Request(
                DEEPSEEK_API_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": "Bearer " + DEEPSEEK_API_KEY,
                    "Content-Type": "application/json",
                    "User-Agent": "Lucas/1.0"
                },
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            if "choices" in data and data["choices"]:
                return data["choices"][0]["message"]["content"]

            raise ValueError("Empty DeepSeek response")
        except urllib.error.HTTPError as exc:
            if exc.code == 402:
                return (
                    "Your DeepSeek key is valid but has no available credit or billing. "
                    "The app is falling back to the local Ollama setup. "
                    "Please add balance or remove the key to use the local model."
                )
            raise

    try:
        response = ollama_client.chat(
            model=ollama_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ]
        )
        return response["message"]["content"]
    except Exception:
        return get_fallback_reply(text)


@app.route("/chat", methods=["POST"])
def chat():


    try:

        data=request.json


        text=data["message"]

        chat_id=data.get("chat_id")



        if not chat_id:


            chat=Chat(

                user_id=session["user_id"],

                title=text[:40],

                created_at=datetime.now().isoformat()

            )


            db.session.add(chat)

            db.session.commit()


            chat_id=chat.id




        user_message = Message(

            chat_id=chat_id,

            role="user",

            content=text

        )

        db.session.add(user_message)

        db.session.commit()


        # image generation requests are handled directly
        if detect_image_request(text):

            image_path = generate_image(
                build_image_prompt(text)
            )

            if image_path:
                reply = "IMAGE::" + image_path
            else:
                reply = "Error: image generation failed. Please try again."

            image_message = Message(
                chat_id=chat_id,
                role="assistant",
                content=reply
            )

            db.session.add(image_message)
            db.session.commit()

            return jsonify({
                "reply":reply,
                "chat_id":chat_id
            })





        try:
            reply = ask_model(text, SYSTEM_PROMPT)
        except Exception as exc:
            message = str(exc).lower()
            if "connect" in message or "ollama" in message or "failed to connect" in message or "not found" in message:
                reply = get_fallback_reply(text)
            else:
                raise




        assistant_message = Message(

            chat_id=chat_id,

            role="assistant",

            content=reply

        )

        db.session.add(assistant_message)

        db.session.commit()



        return jsonify({

            "reply":reply,

            "chat_id":chat_id,

            "user_message_id":user_message.id,

            "assistant_message_id":assistant_message.id

        })



    except Exception as e:

        db.session.rollback()

        if getattr(e, "status_code", None) == 401:
            return jsonify({
                "reply": "Ollama Cloud rejected the API key. "
                "Update OLLAMA_API_KEY in Vercel and redeploy."
            })

        return jsonify({

            "reply":"Error: "+str(e)

        })






# ================= IMAGE GENERATION =================


IMAGE_URL_TEMPLATE = (
    "https://image.pollinations.ai/prompt/{prompt}"
    "?width=768&height=768&nologo=true"
)


IMAGE_KEYWORDS = [
    "image","picture","photo","art","artwork","logo","drawing",
    "painting","illustration","poster","wallpaper","portrait"
]

IMAGE_VERBS = [
    "create","generate","make","draw","paint","design","produce",
    "give me","show me"
]


def detect_image_request(text):

    lower = text.lower().strip()

    # capability questions like "can you create images?" are NOT
    # image requests - the text model should answer them
    question_starts = [
        "can you","could you","would you","do you",
        "are you","what can","who are","why do","how do"
    ]

    starts_question = any(
        lower.startswith(q) for q in question_starts
    )

    has_specific_subject = any(
        s in lower for s in [
            "image of","picture of","photo of","image showing",
            "picture showing","artwork of","logo for","logo of"
        ]
    )

    if starts_question and not has_specific_subject:
        return False

    # imperative drawing commands like "draw a cat" count on their own
    imperative_starts = [
        "draw ","draw me ","paint ","paint me ","sketch ",
        "sketch me ","design an image","design a logo",
        "design me a logo","create an image","create a image",
        "create me an image","generate an image","generate a image",
        "generate me an image","make an image","make a image",
        "make me an image","show me an image","show me a picture",
        "i want an image","i need an image","i want a picture",
        "i need a picture","give me an image","give me a picture",
    ]

    if any(lower.startswith(s) for s in imperative_starts):
        return True

    has_verb = any(v in lower for v in IMAGE_VERBS)
    has_keyword = any(k in lower for k in IMAGE_KEYWORDS)

    return has_verb and has_keyword



def build_image_prompt(text):

    # strip common command prefixes
    cleaned = text.strip()
    lower = cleaned.lower()

    for prefix in [
        "please create an image of ","please create an image ",
        "please generate an image of ","please generate an image ",
        "please draw ","create an image of ","create an image ",
        "create a image of ","create me an image of ",
        "generate an image of ","generate an image ",
        "generate a image of ","generate me an image of ",
        "make an image of ","make an image ",
        "make me an image of ","draw an image of ","draw ","draw me ",
        "paint ","design an image of ","design ",
        "create a picture of ","create a picture ",
        "generate a picture of ","generate a picture ",
        "make a picture of ","make a picture ",
    ]:
        if lower.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break

    return cleaned.strip() or text.strip()


def generate_image(prompt):

    try:
        url = IMAGE_URL_TEMPLATE.format(
            prompt=urllib.parse.quote(prompt)
        )

        request = urllib.request.Request(
            url,
            headers={
                "User-Agent":"Mozilla/5.0 (Lucas AI assistant)"
            }
        )

        with urllib.request.urlopen(request, timeout=90) as response:
            image_data = response.read()

        if len(image_data) < 1000:
            return None

        filename = uuid.uuid4().hex + ".jpg"

        filepath = "static/images/gen/" + filename

        with open(filepath, "wb") as f:
            f.write(image_data)

        return "static/images/gen/" + filename

    except Exception:
        return None






# ================= EDIT MESSAGE =================


@app.route("/edit_message", methods=["POST"])
def edit_message():


    try:
        data = request.json

        message_id = data.get("message_id")

        new_text = data.get("new_text")

        if not message_id or not new_text:
            return jsonify({"reply": "Error: missing data"})


        user_message = Message.query.filter_by(
            id=message_id
        ).first()

        if not user_message or user_message.role != "user":
            return jsonify({"reply": "Error: message not found"})


        chat = Chat.query.filter_by(
            id=user_message.chat_id,
            user_id=session["user_id"]
        ).first()

        if not chat:
            return jsonify({"reply": "Error: not allowed"})


        following = Message.query.filter(
            Message.chat_id == user_message.chat_id,
            Message.id > message_id
        ).all()

        for m in following:
            db.session.delete(m)

        user_message.content = new_text
        db.session.commit()


        reply = ask_model(new_text, SYSTEM_PROMPT)

        assistant_message = Message(
            chat_id=chat.id,
            role="assistant",
            content=reply
        )

        db.session.add(assistant_message)
        db.session.commit()

        return jsonify({
            "reply": reply,
            "chat_id": chat.id,
            "user_message_id": user_message.id,
            "assistant_message_id": assistant_message.id
        })

    except Exception as e:

        db.session.rollback()

        if getattr(e, "status_code", None) == 401:
            return jsonify({
                "reply": "Ollama Cloud rejected the API key. "
                "Update OLLAMA_API_KEY in Vercel and redeploy."
            })

        return jsonify({
            "reply": "Error: " + str(e)
        })







# ================= GOOGLE LOGIN =================


GOOGLE_TOKENINFO_URL = (
    "https://oauth2.googleapis.com/tokeninfo?id_token="
)

FIREBASE_LOOKUP_URL = (
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="
)

FIREBASE_API_KEY = os.getenv(
    "FIREBASE_API_KEY",
    "AIzaSyAVJnXy-s3vO7owCqYyUpb2EwQP8oJYJaI"
)


@app.route("/google_login", methods=["POST"])
def google_login():


    try:
        data = request.json

        credential = data.get("credential")

        if not credential:
            return jsonify({"ok": False, "error": "missing credential"})


        token_url = GOOGLE_TOKENINFO_URL + credential

        req = urllib.request.Request(
            token_url,
            headers={"User-Agent": "Lucas/1.0"}
        )

        with urllib.request.urlopen(req, timeout=15) as resp:
            info = json.loads(resp.read().decode())


        # token must belong to this Firebase project (sender id 901118158983)
        if not info.get("aud", "").startswith("901118158983"):
            return jsonify({"ok": False, "error": "wrong audience"})


        if info.get("email_verified") not in ("true", True):
            return jsonify({"ok": False, "error": "email not verified"})


        email = info.get("email")

        if not email:
            return jsonify({"ok": False, "error": "no email in token"})

        name = info.get("name") or email.split("@")[0]


        base_username = "".join(
            ch for ch in name if ch.isalnum() or ch == "_"
        ) or "user"

        username = base_username

        suffix = 1

        while User.query.filter_by(username=username).first():
            suffix += 1
            username = base_username + str(suffix)


        user = User.query.filter_by(email=email).first()

        if not user:
            user = User(
                username=username,
                password=generate_password_hash(uuid.uuid4().hex),
                email=email,
                display_name=name
            )
            db.session.add(user)
            db.session.commit()
        else:
            user.email = email
            user.display_name = name
            db.session.commit()


        session["user_id"] = user.id

        return jsonify({
            "ok": True,
            "username": user.username
        })

    except urllib.error.HTTPError:
        return jsonify({"ok": False, "error": "invalid or expired token"})

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})


@app.route("/github_login", methods=["POST"])
def github_login():
    try:
        credential = (request.json or {}).get("credential")

        if not credential:
            return jsonify({"ok": False, "error": "missing credential"})

        payload = json.dumps({"idToken": credential}).encode()
        req = urllib.request.Request(
            FIREBASE_LOOKUP_URL + urllib.parse.quote(FIREBASE_API_KEY),
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Lucas/1.0"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=15) as resp:
            info = json.loads(resp.read().decode())

        firebase_user = (info.get("users") or [None])[0]
        if not firebase_user:
            return jsonify({"ok": False, "error": "invalid credential"})

        email = firebase_user.get("email")
        name = firebase_user.get("displayName") or email or "github_user"
        base_username = "".join(
            ch for ch in name if ch.isalnum() or ch == "_"
        ) or "user"

        user = User.query.filter_by(email=email).first() if email else None
        if not user:
            username = base_username
            suffix = 1
            while User.query.filter_by(username=username).first():
                suffix += 1
                username = base_username + str(suffix)

            user = User(
                username=username,
                password=generate_password_hash(uuid.uuid4().hex),
                email=email,
                display_name=name
            )
            db.session.add(user)
            db.session.commit()
        else:
            user.display_name = name
            db.session.commit()

        session["user_id"] = user.id
        return jsonify({"ok": True, "username": user.username})

    except urllib.error.HTTPError:
        return jsonify({"ok": False, "error": "invalid or expired credential"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"ok": False, "error": str(e)})







# ================= SIDEBAR =================


@app.route("/chats")
def chats():


    chats = Chat.query.filter_by(

        user_id=session["user_id"]

    ).order_by(

        Chat.id.desc()

    ).all()



    return jsonify([

        {
            "id":c.id,

            "title":c.title

        }

        for c in chats

    ])





@app.route("/load_chat/<int:id>")
def load_chat(id):


    messages = Message.query.filter_by(

        chat_id=id

    ).all()



    return jsonify([

        {

        "id":m.id,


        "role":m.role,

        "content":m.content

        }

        for m in messages

    ])







# ================= START =================


with app.app_context():

    db.create_all()

    # add email column for older databases
    with db.engine.connect() as conn:
        cols = conn.execute(
            db.text("PRAGMA table_info(user)")
        ).fetchall()
        if "email" not in [c[1] for c in cols]:
            conn.execute(
                db.text("ALTER TABLE user ADD COLUMN email VARCHAR(200)")
            )
            conn.commit()
        if "display_name" not in [c[1] for c in cols]:
            conn.execute(
                db.text("ALTER TABLE user ADD COLUMN display_name VARCHAR(200)")
            )
            conn.commit()
        conn.execute(
            db.text("UPDATE user SET display_name = username "
                    "WHERE display_name IS NULL")
        )
        conn.commit()



if __name__=="__main__":

    app.run(

        host="127.0.0.1",

        port=5000,

        debug=False

    )