import {
  AppShell,
  Center,
  Stack,
  Tooltip,
  UnstyledButton,
  rem,
} from "@mantine/core";

import {
  IconAdjustments,
  IconGeometry,
  IconLayoutDashboard,
  IconLogout,
} from "@tabler/icons-react";

import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

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
    <Tooltip label={label} position="right" transitionProps={{ duration: 0 }}>
      <UnstyledButton
        onClick={onClick}
        className="navbar-link"
        data-active={active || undefined}
      >
        <Icon style={{ width: rem(20), height: rem(20) }} stroke={1.5} />
      </UnstyledButton>
    </Tooltip>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    {
      icon: IconGeometry,
      label: "Geometry",
      path: "/geometry",
    },
    {
      icon: IconLayoutDashboard,
      label: "Layouts",
      path: "/layouts",
    },
    {
      icon: IconAdjustments,
      label: "Profils",
      path: "/profiles",
    },
  ];

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

        <Stack justify="center" gap={8} style={{ flex: 1 }}>
          {links.map((link) => (
            <NavbarLink
              key={link.label}
              icon={link.icon}
              label={link.label}
              active={location.pathname === link.path}
              onClick={() => navigate(link.path)}
            />
          ))}
        </Stack>

        <Stack justify="center" gap={8}>
          <NavbarLink
            icon={IconLogout}
            label="Quitter"
            onClick={() => {}}
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/geometry" element={<Geometry />} />

          <Route
            path="/"
            element={<Navigate to="/geometry" replace />}
          />

          <Route
            path="*"
            element={<Navigate to="/geometry" replace />}
          />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}