import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("kinder/:id", "routes/kinder.$id.tsx"),
  route("kinder/:id/bearbeiten", "routes/kinder.$id_.bearbeiten.tsx"),
  route("kinder/neu", "routes/kinder.neu.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
] satisfies RouteConfig;
