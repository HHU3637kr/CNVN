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
    ],
  },
  { path: "/classroom/:id", Component: Classroom },
]);
