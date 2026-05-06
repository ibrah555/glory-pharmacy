# Glory Pharmacy Management System - Installation Guide

Welcome! This guide will walk you through setting up the Glory Pharmacy Management System on your Windows computer.

## 📌 Prerequisites

Before installing the software, ensure you have the following installed:

1.  **Node.js (v18 or higher)**: [Download here](https://nodejs.org/en/download/) (Choose the "LTS" version).
2.  **XAMPP (for MySQL Database)**: [Download here](https://www.apachefriends.org/download.html).

---

## 🚀 Step 1: Initial Setup

1.  **Download the Software**: Extract the provided ZIP file to a permanent location on your computer (e.g., `C:\GloryPharmacy`).
2.  **Start the Database**:
    -   Open the **XAMPP Control Panel**.
    -   Click **Start** next to **MySQL**.
    -   (Optional) If you haven't created the database yet, the script will attempt to do it for you, but ensure MySQL is running.

---

## 🛠️ Step 2: Run the Setup Utility

1.  Open the folder where you extracted the software.
2.  Navigate to the `scripts` folder.
3.  Right-click on `setup.bat` and select **Run as Administrator**.
4.  Follow the on-screen instructions. This script will:
    -   Install all necessary internal components.
    -   Initialize the database with the default admin user.

---

## 📦 Step 3: Build and Run the App

Once the setup is complete, you can generate the desktop installer:

1.  Open a Command Prompt in the main folder.
2.  Run the following command to build the installer:
    ```bash
    npm run electron:build
    ```
3.  After the build finishes, you will find the installer in the `dist-electron` folder (e.g., `Glory Pharmacy Setup 1.0.0.exe`).
4.  Run the installer to install the app as a regular Windows desktop application.

---

## 🔐 Default Login Credentials

-   **Username**: `admin`
-   **Password**: `admin123`

> [!IMPORTANT]
> Please change your password immediately after your first login for security reasons.

## 🆘 Support

If you encounter any issues during installation, please contact the system administrator.
