import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/HomePage";
import QuestionPage from "./pages/QuestionPage";
import ResultsPage from "./pages/ResultsPage";
import AdminDashboard from "./pages/AdminDashboard";
import FacilityDashboard from "./pages/FacilityDashboard";
import UpdatesPage from "./pages/UpdatesPage";
import AdminExperimentsPage from "./pages/AdminExperimentsPage";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/question/:id"} component={QuestionPage} />
      <Route path={"/results"} component={ResultsPage} />
      <Route path={"/results/:id"} component={ResultsPage} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/facility/:code"} component={FacilityDashboard} />
      <Route path={"/updates/:id"} component={UpdatesPage} />
      <Route path={"/updates"} component={UpdatesPage} />
      <Route path={"/404"} component={NotFound} />
      <Route path={"/admin/experiments"} component={AdminExperimentsPage} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
