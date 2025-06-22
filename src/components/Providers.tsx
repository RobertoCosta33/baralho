"use client";

import { ThemeProvider as StyledThemeProvider } from "styled-components";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";

const styledTheme = {
  colors: {
    primary: "#1976d2",
    background: "#fff",
    text: "#171717",
  },
};

const muiTheme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    background: {
      default: "#fff",
    },
    text: {
      primary: "#171717",
    },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StyledThemeProvider theme={styledTheme}>
      <MuiThemeProvider theme={muiTheme}>
        {children}
      </MuiThemeProvider>
    </StyledThemeProvider>
  );
} 