import { createBrowserRouter } from "react-router";
import { Layout } from "./Layout";
import { Home } from "./pages/Home";
import { Teachers } from "./pages/Teachers";
import { TeacherProfile } from "./pages/TeacherProfile";
import { StudentDashboard } from "./pages/StudentDashboard";
import { TeacherDashboard } from "./pages/TeacherDashboard";
import { Classroom } from "./pages/Classroom";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Wallet } from "./pages/Wallet";
import { PaymentOrderDetail } from "./pages/PaymentOrderDetail";
import { Payouts } from "./pages/Payouts";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "teachers", Component: Teachers },
      { path: "teachers/:id", Component: TeacherProfile },
      { path: "dashboard/student", Component: StudentDashboard },
      { path: "dashboard/teacher", Component: TeacherDashboard },
      { path: "login", Component: Login },
      { path: "register", Component: Register },
      { path: "wallet", Component: Wallet },
      { path: "payments/orders/:orderId", Component: PaymentOrderDetail },
      { path: "payouts", Component: Payouts },
    ],
  },
  { path: "/classroom/:id", Component: Classroom },
]);
