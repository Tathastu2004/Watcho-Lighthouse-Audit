
# Watcho Lighthouse Audit

A robust, automated Lighthouse auditing solution for Watcho.com and its key pages. This project runs performance, accessibility, SEO, and best-practices audits, generates timestamped HTML reports, and provides a modern, industry-standard workflow for web quality assurance.

---


## ⚠️ Important Usage Notes
- In your `.env` file, the `MOBILE_NUMBER` is set to the author's phone number. **Replace it with your own** before running the audit.
- The `RUNS` variable controls how many times Lighthouse audits each page (default is 3, and the average is taken). You can set it to 1 for a single run or increase it for more robust averages.
- You can add more URLs to the `URLS` array in `audit.js` as needed.
- When you run the audit, a browser window will open for manual login. **Complete the login in the browser, then return to the terminal to continue the audit process.**
- **At the start of each audit, you will be prompted in the terminal to select either `mobile` or `desktop` mode.** This determines whether the Lighthouse audit emulates a mobile device or a desktop environment. Choose the mode that matches your testing needs or matches how you run manual audits in Chrome DevTools.

---

## 🚀 Features
- **Automated Lighthouse Audits** for multiple URLs (public and logged-in pages)
- **Manual OTP Login** support for authenticated audits
- **Timestamped Reports**: Each run is saved with a unique timestamp
- **Auto-Cleanup**: Only the most recent report is kept for each page
- **Beautiful Index Page**: `reports/index.html` summarizes all results and links to every report
- **Open All Reports Script**: Instantly open all HTML reports in your browser
- **Configurable via `.env`**: Easily set environment variables like mobile number

---

## 📂 Project Structure
```
watcho-lh-audit/
├── .env                  # Environment variables (e.g., MOBILE_NUMBER)
├── audit.js              # Main audit script (Node.js, Puppeteer, Lighthouse)
├── open-reports.js       # Script to open all HTML reports at once
├── package.json          # Node.js dependencies and scripts
├── requirements.txt      # Project requirements and setup notes
├── reports/              # All audit results and index page
│   ├── index.html        # Summary and navigation for all reports
│   └── ...               # Folders for each audited URL
└── ...
```

---

## 🛠️ Requirements
- **Node.js v20.x** (LTS recommended)
- **npm** (comes with Node.js)

All Node.js dependencies are managed in `package.json` and installed automatically.

---

## ⚡ Quick Start
1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Configure environment:**
   - Create a `.env` file with required variables (e.g., `MOBILE_NUMBER=your_number`)
3. **Run the audit:**
   ```sh
   npm run audit
   ```
   - Follow the prompt to complete OTP login in the browser window.
4. **View results:**
   - Open `reports/index.html` for a summary and links to all reports.
   - Or run:
     ```sh
     node open-reports.js
     ```
     to open all HTML reports at once.

---

## 📊 How It Works
- **audit.js** launches Chrome, logs in (if needed), and runs Lighthouse audits for each URL.
- Each report is saved with a timestamp (e.g., `run-1-2025-08-26T14-30-00.html`).
- After each run, only the most recent report is kept for each page; older reports are deleted.
- `reports/index.html` is auto-generated and summarizes all results, including key scores (Performance, Accessibility, SEO, PWA).

---

## 📝 Customization
- **Add/Remove URLs:** Edit the `URLS` array in `audit.js`.
- **Change login flow:** Update selectors in `audit.js` if the Watcho login page changes.
- **Keep more reports:** Modify the cleanup logic in `audit.js` to retain more than one report per page.
- **Add notifications or CI/CD:** Integrate with email, Slack, or CI pipelines as needed.

---

## 📢 Notes
- This project is designed for Node.js. The `requirements.txt` is for documentation only unless you add Python scripts.
- All reports and summaries are local; no data is sent externally.
- For best results, use a stable internet connection and the latest Chrome browser.

---

## 🤝 Contributing
Pull requests and suggestions are welcome! Please open an issue or PR for improvements.

---

## 📄 License
MIT License
