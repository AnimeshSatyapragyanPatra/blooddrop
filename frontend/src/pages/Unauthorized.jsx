import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Unauthorized() {
  const { homePath } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">You do not have access to that page</h1>
        <p className="mt-2 text-sm text-stone-500">Your account role does not include this area.</p>
        <Link to={homePath()} className="btn-primary mt-6">
          Back to my dashboard
        </Link>
      </div>
    </div>
  );
}
