# Learnovo - Comprehensive School Management System

 Learnovo is a modern, full-stack web application designed to streamline administrative, academic, and financial operations for educational institutions. It provides a robust platform for managing students, employees, transport, fees, and more, with role-based access control.

## 🚀 Key Features

*   **Dashboard**: Real-time overview of school statistics, attendance, and financial summaries.
*   **User Management**:
    *   **Students**: Comprehensive profiles, admission management, academic history, and document storage.
    *   **Employees/Teachers**: Staff profiles, assignments, and role management.
    *   **Drivers**: Transport staff management.
*   **Academic Management**:
    *   **Classes & Sections**: Standardized class management (Nursery - 12th).
    *   **Subjects**: Subject allocation and management.
    *   **Assignments**: Digital assignment creation and tracking.
    *   **Exams**: Examination scheduling and result management.
    *   **Certificates**: Automated certificate generation (Transfer, Character, etc.).
*   **Finance Module**:
    *   **Fee Structures**: Flexible fee creation (tuition, transport, etc.).
    *   **Invoices**: Automated invoice generation and tracking.
    *   **Payments**: Razorpay integration for online fee collection.
    *   **Reports**: Detailed financial reports and balance sheets.
*   **Transport Management**:
    *   **Routes & Stops**: Route planning and stop management.
    *   **Vehicles**: Fleet management.
    *   **Assignments**: Student transport allocation with specific pick-up/drop-off points.
    *   **Export**: Transport lists exportable by driver and route.
*   **Attendance**: Daily attendance tracking for both students and employees.
*   **Communication**: Notification system for announcements and alerts.
*   **Settings**: Global school configuration, including logo, tagline, and academic sessions.

## 🛠️ Technology Stack

### Frontend
*   **Framework**: React (Vite)
*   **Styling**: Tailwind CSS
*   **State/Data**: React Hook Form, Axios
*   **UI Components**: Headless UI, Lucide React (Icons)
*   **Charts**: Chart.js, React Chartjs 2
*   **Utilities**: date-fns, clsx

### Backend
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: MongoDB (Mongoose ODM)
*   **Authentication**: JSON Web Token (JWT), bcryptjs
*   **File Handling**: Multer, PDFKit, ExcelJS, CSV Parser
*   **Payments**: Razorpay
*   **Validation**: Express Validator, Joi
*   **Utilities**: Cron (scheduling), Nodemailer (email)

## 📋 Prerequisites

*   Node.js (v18+ recommended)
*   MongoDB (Local or Atlas)
*   npm or yarn

## ⚙️ Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone <repository_url>
    cd learnovo
    ```

2.  **Backend Setup**
    ```bash
    cd learnovo-backend
    npm install
    ```
    *   Create a `.env` file in `learnovo-backend` with the following variables:
        ```env
        PORT=5001
        MONGO_URI=mongodb://localhost:27017/learnovo # or your Atlas URI
        JWT_SECRET=your_jwt_secret_key
        CLIENT_URL=http://localhost:5173 
        # Add other specific secrets (Razorpay, Email, etc.)
        ```

3.  **Frontend Setup**
    ```bash
    cd ../learnovo-frontend
    npm install
    ```
    *   Create a `.env` file in `learnovo-frontend`:
        ```env
        VITE_API_URL=http://localhost:5001
        ```

## 🚀 Running the Application

**Development Mode:**

You will need to run both the backend and frontend servers concurrently.

1.  **Start Backend:**
    ```bash
    cd learnovo-backend
    npm run dev
    ```
    *(Server usually runs on port 5001)*

2.  **Start Frontend:**
    ```bash
    cd learnovo-frontend
    npm run dev
    ```
    *(Vite server usually runs on port 5173)*

3.  Access the application at `http://localhost:5173`.

## 📂 Project Structure

```
Learnovo/
├── learnovo-backend/       # Express API Server
│   ├── models/             # Mongoose Schemas (User, Student, Fee, etc.)
│   ├── routes/             # API Endpoints
│   ├── scripts/            # Database seeding and utility scripts
│   └── server.js           # Entry point
│
└── learnovo-frontend/      # React Client
    ├── src/
    │   ├── components/     # Reusable UI components
    │   ├── pages/          # Application pages (Dashboard, Students, Finance, etc.)
    │   ├── services/       # API call handlers
    │   └── context/        # React Context (Auth, etc.)
    └── index.html
```

## 📄 License

This project is proprietary software developed by EvoTech Innovation.
