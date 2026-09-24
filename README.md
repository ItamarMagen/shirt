# 🎉 The Wedding Crew: QR shirt gallery

## 1. Add your photos
1. Copy your photos into the `photos/` folder (and delete the `placeholder-*.svg` files).
2. Shrink them so they load fast on phones (optional, recommended):
   `bash tools/resize.sh`
3. Open `photos.js` and list each photo with a caption, in the order you want:
   ```js
   { src: "photos/dan.jpg", caption: "Dan after the 3rd tequila" },
   ```
   File names are case-sensitive on GitHub (`Dan.JPG` ≠ `dan.jpg`).

### Videos
Videos work too. Convert each one first so it's small and plays on every phone:
```
bash tools/video.sh "pictures/IMG_1234.MOV" photos/dance.mp4
```
Then add it to `photos.js` like a photo: `{ src: "photos/dance.mp4", caption: "..." }`.
In the feed videos autoplay muted and loop; tapping opens them full screen with sound.
Keep clips short (under ~30 seconds); GitHub rejects files over 100 MB.

## 2. Publish on GitHub Pages (free)
1. Go to https://github.com/new and create a **public** repo, e.g. `wedding-crew`.
2. Click **"uploading an existing file"**. Drag in everything in this folder
   (`index.html`, `style.css`, `app.js`, `photos.js`, `photos/`) and click **Commit**.
3. Open **Settings → Pages**. Under *Branch*, pick `main` and `/ (root)`, then click **Save**.
4. After about a minute the site is live at `https://YOUR-USERNAME.github.io/wedding-crew/`.

To change photos later, upload the new files and the updated `photos.js`. The URL (and the QR code) stays the same.

## 3. Make the QR code
```
bash tools/make-qr.sh https://YOUR-USERNAME.github.io/wedding-crew/
```
This creates:
- `qr/qr.svg`: vector file, best to send to the shirt printer
- `qr/qr.png`: black on white
- `qr/qr-white.png`: white on transparent, for dark shirts

**Print tips:** make it at least 5 × 5 cm, keep the white border around it, and
**scan a test print with your phone before printing all the shirts.**
