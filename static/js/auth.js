// ==============================================
// LUCAS - FIREBASE SOCIAL LOGIN
// ==============================================

// ==============================================
// ERROR DISPLAY
// ==============================================

function showAuthError(message){
    const box = document.getElementById("authError");

    if(box){
        box.textContent = message;
        box.classList.remove("hidden");
    }
}

function hideAuthError(){
    const box = document.getElementById("authError");

    if(box){
        box.classList.add("hidden");
    }
}

// ==============================================
// FRIENDLY ERROR MESSAGES
// ==============================================

function friendlyError(code){
    const map = {
        "auth/popup-closed-by-user":
            "Sign-in window was closed before finishing.",

        "auth/cancelled-popup-request":
            "Sign-in window was closed before finishing.",

        "auth/popup-blocked":
            "Your browser blocked the sign-in window. " +
            "Allow popups for this site and try again.",

        "auth/unauthorized-domain":
            "This address is not authorized in Firebase. " +
            "Add it under Authentication > Settings > " +
            "Authorized domains.",

        "auth/network-request-failed":
            "Network problem. Check your internet connection.",

        "auth/account-exists-with-different-credential":
            "An account already exists with a different sign-in method.",

        "auth/operation-not-allowed":
            "This sign-in provider is not enabled in Firebase yet."
    };

    return map[code] ||
        "Google sign-in failed. Please try again.";
}

// ==============================================
// GOOGLE SIGN IN
// ==============================================

const googleBtn = document.querySelector(".btn-google");

if(googleBtn){
    googleBtn.addEventListener("click", async ()=>{

        hideAuthError();

        if(typeof firebase === "undefined"){
            showAuthError(
                "Could not load sign-in service. Check your internet."
            );
            return;
        }

        const provider =
            new firebase.auth.GoogleAuthProvider();

        try{
            const result =
                await firebase.auth().signInWithPopup(provider);

            const idToken =
                await result.user.getIdToken();

            const response = await fetch("/google_login",{
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    credential:idToken
                })
            });

            const data = await response.json();

            if(data.ok){
                window.location.href = "/";
            }else{
                showAuthError(data.error || "Sign-in failed.");
            }
        }
        catch(err){
            showAuthError(
                friendlyError(err && err.code)
            );
        }
    });
}

// ==============================================
// GITHUB SIGN IN
// ==============================================

const githubBtn = document.querySelector(".btn-github");

if(githubBtn){
    githubBtn.addEventListener("click", async ()=>{
        hideAuthError();

        if(typeof firebase === "undefined"){
            showAuthError(
                "Could not load sign-in service. Check your internet."
            );
            return;
        }

        const provider = new firebase.auth.GithubAuthProvider();

        try{
            const result =
                await firebase.auth().signInWithPopup(provider);

            const idToken =
                await result.user.getIdToken();

            const response = await fetch("/github_login",{
                method:"POST",
                headers:{
                    "Content-Type":"application/json"
                },
                body:JSON.stringify({
                    credential:idToken
                })
            });

            const data = await response.json();

            if(data.ok){
                window.location.href = "/";
            }else{
                showAuthError(data.error || "GitHub sign-in failed.");
            }
        }
        catch(err){
            showAuthError(
                friendlyError(err && err.code)
            );
        }
    });
}
