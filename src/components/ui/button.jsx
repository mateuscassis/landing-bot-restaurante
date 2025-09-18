import React from "react";

export function Button({ children, className = "", size = "md", ...props }) {
  const sizes = {
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };
  return (
    <button
      className={`rounded ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}