# VR Zone Check-In System

A Google Sheets-based system for managing VR event check-ins, check-outs, and waitlists. This project utilizes Google Apps Script to streamline attendee management for VR events.

## 🛠️ **Features**

- **Individual Check-In:** Quickly check in attendees by verifying their information from the Legal sheet.
- **Group Check-In:** Efficiently manage group entries with accurate data verification.
- **Waitlist Management:** Automatically add attendees to a waitlist when VR spaces are unavailable.
- **Check-Out Process:** Seamlessly check out attendees and free up VR spaces.
- **Error Handling:** Logs discrepancies and manages duplicate entries effectively.

## 🚀 **Getting Started**

### 📋 **Prerequisites**

- **Google Account:** To use Google Sheets and Apps Script.
- **GitHub Account:** To access the repository (currently private).

### 🔧 **Setup Instructions**

1. **Clone the Repository:**
   - Open GitHub Desktop.
   - Go to `File` > `Clone Repository`.
   - Select `URL` and paste your repository URL.
   - Choose a local path and click `Clone`.

2. **Open the Project in Google Sheets:**
   - Navigate to your Google Sheets document associated with the project.
   - Open the Apps Script editor via `Extensions` > `Apps Script`.

3. **Deploy the Script:**
   - Ensure all scripts are correctly linked and authorized.
   - Test individual and group check-in processes to verify functionality.

## 📚 **Documentation**

- **Sheets Structure:**
  - **Legal:** Contains attendee information.
  - **VRSpaces:** Tracks available VR spaces and their statuses.
  - **Tracker:** Logs check-ins, check-outs, and session details.
  - **Waitlist:** Manages attendees waiting for VR space availability.

- **Scripts Overview:**
  - **Code.gs:** Main script handling check-ins, check-outs, and waitlist management.
  - **HTML Files:** Interfaces for user interactions (e.g., game selection, VR space assignment).

## 📝 **Contributing**

Contributions are welcome! Please ensure that you follow the established coding standards and include appropriate documentation.

## 🛡️ **License**

This project is licensed under the [MIT License](LICENSE).
