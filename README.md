# Glory Pharmacy Management System

A comprehensive, local desktop-based Pharmacy Inventory and Point of Sale (POS) system designed for **Glory Pharmacy** (Hola, Tana River, Kenya).

## 🚀 Key Features

-   **Secure Authentication:** Role-based access control (Super Admin, Store Manager, Pharmacist, Cashier).
-   **Inventory Management:** Advanced batch and expiry tracking with FIFO (First-In-First-Out) selling logic.
-   **Point of Sale (POS):** Fast product search, cart management, and receipt printing.
-   **M-Pesa Integration:** Support for Safaricom Daraja API STK Push (Sandbox and Production modes).
-   **Reporting & Analytics:** Sales trends, top products, and financial reports with PDF/Excel/CSV export.
-   **Audit & Security:** Full audit logging of all system activities and suspicious activity detection.
-   **Database Backups:** Easy database backup and settings management.

## 🛠️ Tech Stack

-   **Frontend:** React (Vite), Chart.js, React Router, Axios.
-   -   **Backend:** Node.js (Express), SQLite (better-sqlite3), JWT, Bcrypt.
-   **Design:** Custom Vanilla CSS with a modern pharmacy-themed aesthetic.

## 📦 Installation & Setup

### Prerequisites
-   [Node.js](https://nodejs.org/) (v16 or higher)
-   npm (comes with Node.js)

### 1. Clone the Repository
```bash
git clone https://github.com/ibrah555/glory-pharmacy.git
cd glory-pharmacy
```

### 2. Setup the Backend
```bash
cd backend
npm install
node seed.js  # Populates initial Admin user and sample data
node server.js # Starts backend on http://localhost:5001
```

### 3. Setup the Frontend
```bash
cd ../frontend
npm install
npm run dev    # Starts frontend on http://localhost:5173
```

## 🔐 Default Credentials
-   **Username:** `admin`
-   **Password:** `admin123`
*(Please change the password immediately after first login.)*

## 📱 M-Pesa Configuration
To enable live M-Pesa payments:
1.  Log in as **Super Admin**.
2.  Navigate to **Settings**.
3.  Enter your Safaricom Daraja API credentials (Consumer Key, Secret, Shortcode, Passkey).
4.  Switch the environment to **Production** and save.

## 📄 License
This project is proprietary and built specifically for Glory Pharmacy.
