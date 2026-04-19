import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Route, Switch } from "wouter";

import Admin from "@/pages/Admin";
import AdminSettings from "@/pages/AdminSettings";
import Checkout from "@/pages/Checkout";
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";
import Items from "@/pages/Items";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import PaymentFailure from "@/pages/PaymentFailure";
import PaymentPending from "@/pages/PaymentPending";
import PaymentSuccess from "@/pages/PaymentSuccess";
import Privacy from "@/pages/Privacy";
import Register from "@/pages/Register";
import Terms from "@/pages/Terms";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Toaster position="top-right" />
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/register" component={Register} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/items" component={Items} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/payment/success" component={PaymentSuccess} />
          <Route path="/payment/pending" component={PaymentPending} />
          <Route path="/payment/failure" component={PaymentFailure} />
          <Route path="/admin/settings" component={AdminSettings} />
          <Route path="/admin" component={Admin} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route component={NotFound} />
        </Switch>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
