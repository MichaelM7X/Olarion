import { createBrowserRouter } from "react-router";
import { Landing } from "./pages/Landing";
import { AuditSetup } from "./pages/AuditSetup";
import { AuditResults } from "./pages/AuditResults";
import { PastAudits } from "./pages/PastAudits";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/past-audits",
    Component: PastAudits,
  },
  {
    path: "/setup",
    Component: AuditSetup,
  },
  {
    path: "/results",
    Component: AuditResults,
  },
]);