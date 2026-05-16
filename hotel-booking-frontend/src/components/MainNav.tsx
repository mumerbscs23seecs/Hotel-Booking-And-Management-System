import { Button } from "./ui/button";
import UsernameMenu from "./UsernameMenu";
import { Link } from "react-router-dom";
import useAppContext from "../hooks/useAppContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ChevronDown, FileText, Activity } from "lucide-react";
import { getHotelsSearchUrl } from "../lib/nav-utils";

const NAV_AUTH_WIDTH = "min-w-[120px]";

const navLinkClass =
  "flex items-center text-white/90 hover:text-white px-4 py-2 rounded-lg font-medium hover:bg-white/10 transition-all duration-200";

const MainNav = () => {
  const { isLoggedIn } = useAppContext();

  return (
    <nav className="flex items-center gap-1 lg:gap-2">
      <Link to={getHotelsSearchUrl()} className={navLinkClass}>
        Hotels
      </Link>
      <Link to="/my-bookings" className={navLinkClass}>
        My Bookings
      </Link>
      <Link to="/business-insights" className={navLinkClass}>
        Business Insights
      </Link>
      <Link to="/my-hotels" className={navLinkClass}>
        My Hotels
      </Link>




      <div className={`flex items-center justify-end ${NAV_AUTH_WIDTH}`}>
        {isLoggedIn ? (
          <UsernameMenu />
        ) : (
          <Link to="/sign-in">
            <Button
              variant="ghost"
              className="font-bold bg-white text-primary-600 hover:bg-primary-50 hover:text-primary-700 border-2 border-white/80"
            >
              Log In
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default MainNav;
