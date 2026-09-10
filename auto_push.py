import os
import subprocess
import time
from datetime import datetime

REPO = os.getcwd()
POLL_SECONDS = 10


def run(cmd):
    return subprocess.run(cmd, cwd=REPO, text=True, capture_output=True)


def get_branch():
    result = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    if result.returncode == 0:
        return result.stdout.strip() or "main"
    return "main"


print(f"Auto-push watcher started in {REPO}")
print(f"Polling every {POLL_SECONDS} seconds")

while True:
    try:
        status = run(["git", "status", "--porcelain"])
        if status.returncode == 0 and status.stdout.strip():
            branch = get_branch()
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            add = run(["git", "add", "-A"])
            if add.returncode != 0:
                print(f"[{timestamp}] git add failed: {add.stderr.strip()}")
                time.sleep(POLL_SECONDS)
                continue

            commit_msg = f"Auto-push update {timestamp}"
            commit = run(["git", "commit", "-m", commit_msg])
            if commit.returncode == 0:
                print(f"[{timestamp}] committed: {commit_msg}")
            else:
                msg = (commit.stderr or commit.stdout).strip()
                if "nothing to commit" not in msg.lower() and "no changes added" not in msg.lower():
                    print(f"[{timestamp}] commit failed: {msg}")
                else:
                    print(f"[{timestamp}] no new changes to commit")

            push = run(["git", "push", "origin", branch])
            if push.returncode == 0:
                print(f"[{timestamp}] push successful to origin/{branch}")
            else:
                print(f"[{timestamp}] push failed: {(push.stderr or push.stdout).strip()}")

        time.sleep(POLL_SECONDS)
    except KeyboardInterrupt:
        print("Auto-push watcher stopped.")
        break
    except Exception as exc:
        print(f"Watcher error: {exc}")
        time.sleep(POLL_SECONDS)
