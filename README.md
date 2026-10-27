# November Word Tracker: setup

Two parts:

- **Code.gs** runs in Google Apps Script and stores all data in a Google Sheet you own.
- **index.html** is the page your friends use. It's hosted on GitHub Pages.

## 1. Set up the Google Sheet and backend

1. Create a new Google Sheet. Name it something like "Word tracker data."
2. Open **Extensions > Apps Script**.
3. Delete the starter code in `Code.gs` and paste in the contents of this repo's `Code.gs`.
4. Check the settings at the top of the file. The time zone is set to `America/Chicago` (Central Time). Change it if your group is in a different time zone.
5. Click **Save**.
6. In the function dropdown at the top, select `setup` and click **Run**. Approve the permission prompts. This creates the Users, Entries, and Sessions tabs in your sheet.
7. Click **Deploy > New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).

## 2. Set up the page on GitHub

1. Create a new GitHub repository (for example, `word-tracker`).
2. Open `index.html`, find this line near the top of the script, and paste in your web app URL:
   ```js
   const API_URL = 'PASTE_YOUR_APPS_SCRIPT_URL_HERE';
   ```
3. Upload `index.html` to the repository.
4. Go to **Settings > Pages**. Under "Build and deployment," choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
5. After a minute or two, the page is live at `https://<your-username>.github.io/<repo-name>/`.

## 3. Make yourself admin

1. Open the page and create your account.
2. In the Google Sheet, open the **Users** tab and type `TRUE` in the **isAdmin** column on your row.
3. Refresh the page. An **Admin** tab appears.

Register before you share the link, so no one else can take your username.

## 4. Share it

Pin the page link in the WhatsApp group. People can register through **November 1**. After that, registration closes.

## Testing before November 1

Entries can only be logged for November dates up to today, so logging is blocked until November 1. To test early:

1. In `Code.gs`, set `FAKE_TODAY = '2026-11-05'` (any November date).
2. Publish the change: **Deploy > Manage deployments > Edit (pencil icon) > Version: New version > Deploy**. The URL stays the same.
3. Test on the page.
4. When done, delete the test rows from the **Users**, **Entries**, and **Sessions** tabs (keep the header row), set `FAKE_TODAY = ''`, and publish a new version again.

Any edit to `Code.gs` only takes effect after you publish a new version this way.

## Notes

- Passwords are stored as salted hashes, not plain text. This is still a hobby project, so tell everyone not to reuse a password from another site.
- There's no email, so forgotten passwords are reset from the Admin tab.
- The Google Sheet is the full record. You can open it anytime to check or back up the data. If you edit it directly, keep dates in `2026-11-05` format.
- Free GitHub Pages repositories are public, so the backend URL is visible in the code. Every action except registering requires a login, and registration closes after November 1.
- Daily goals can't be changed after registering. The monthly goal is the daily goal × 30.
