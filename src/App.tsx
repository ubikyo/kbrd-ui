import {
  AppShell,
  Center,
  Stack,
  Tooltip,
  UnstyledButton,
  rem,
} from "@mantine/core";
import { IconGeometry } from "@tabler/icons-react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Geometry from "./pages/Geometry";
import "./assets/App.css";

interface NavbarLinkProps {
  icon: typeof IconGeometry;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavbarLink({
  icon: Icon,
  label,
  active,
  onClick,
}: NavbarLinkProps) {
  return (
    <Tooltip
      label={label}
      position="right"
      transitionProps={{ duration: 0 }}
    >
      <UnstyledButton
        onClick={onClick}
        className="navbar-link"
        data-active={active || undefined}
      >
        <Icon
          style={{ width: rem(20), height: rem(20) }}
          stroke={1.5}
        />
      </UnstyledButton>
    </Tooltip>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppShell
      navbar={{
        width: 80,
        breakpoint: "sm",
      }}
      padding="lg"
    >
      <AppShell.Navbar className="navbar">
        <Center className="navbar-logo">
          <strong>K</strong>
        </Center>

        <Stack align="center" gap="sm">
          <NavbarLink
            icon={IconGeometry}
            label="Géométries"
            active={location.pathname === "/geometry"}
            onClick={() => navigate("/geometry")}
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/geometry" element={<Geometry />} />

          <Route
            path="*"
            element={<Navigate to="/geometry" replace />}
          />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}