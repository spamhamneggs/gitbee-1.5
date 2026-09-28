import * as React from "react";

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
    <DirectionContext.Provider value={dir}>
      {children}
    </DirectionContext.Provider>
  );
}

export function useDirection(): Direction {
  return React.useContext(DirectionContext);
}
