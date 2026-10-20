import * as React from "react";
import { use } from "react";

type Direction = "ltr" | "rtl";

const DirectionContext = React.createContext<Direction>("ltr");

export function DirectionProvider({
  dir,
  children,
}: {
  dir: Direction;
  children: React.ReactNode;
}) {
  return (
    <DirectionContext value={dir}>{children}</DirectionContext>
  );
}

export function useDirection(): Direction {
  return use(DirectionContext);
}
