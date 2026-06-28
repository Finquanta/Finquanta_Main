"use client"

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/faq", label: "FAQs" },
  { href: "/newsletter", label: "Newsletter" },
  { href: "/community", label: "Community" },
  { href: "/blog", label: "Blog" },
];

const HamburgerMenu = () => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Open menu with animation
  useEffect(() => {
    if (open && !closing) {
      // Wait a tick to trigger the transition
      const timer = setTimeout(() => setMenuVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setMenuVisible(false);
    }
  }, [open, closing]);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        handleClose();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Trap focus inside menu when open
  useEffect(() => {
    if (!open) return;
    const focusableEls = menuRef.current?.querySelectorAll<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    focusableEls?.[0]?.focus();
  }, [open]);

  // Handle smooth close
  const handleClose = () => {
    setMenuVisible(false);
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 300); // match duration-300
  };

  // Portal content for overlay and drawer
  const portalContent = (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-40 z-[9999] transition-opacity duration-300"
        aria-hidden="true"
        onClick={handleClose}
      ></div>
      {/* Slide-in Menu */}
      <nav
        ref={menuRef}
        className={`fixed top-0 right-0 h-[100vh] w-64 bg-white shadow-lg z-[9999] transform transition-transform duration-300 ease-in-out overflow-x-hidden
          ${menuVisible ? "translate-x-0" : "translate-x-full"}`}
        aria-label="Mobile navigation menu"
        tabIndex={-1}
      >
        {/* Close Icon */}
        <button
          aria-label="Close navigation menu"
          className="absolute top-4 right-4 text-2xl text-gray-700 focus:outline-none"
          onClick={handleClose}
        >
          &times;
        </button>
        {/* Scrollable column so nothing gets cut off on short screens.
            Auth buttons sit at the TOP for easy reach, nav links below. */}
        <div className="flex flex-col h-full pt-16 pb-8 overflow-y-auto">
          {/* Sign Up and Login at the top */}
          <div className="flex flex-col px-4 space-y-3">
            <Link href="/signup" className="w-full" onClick={handleClose}>
              <button className="w-full bg-[#4CAF50] hover:bg-[#45a049] text-white rounded-lg px-5 py-3 font-semibold text-base transition-colors">
                Sign Up
              </button>
            </Link>
            <Link href="/login" className="w-full" onClick={handleClose}>
              <button className="w-full bg-gray-50 hover:bg-gray-100 text-[#4CAF50] rounded-lg px-5 py-3 font-semibold text-base border border-[#4CAF50] transition-colors">
                Login
              </button>
            </Link>
          </div>
          {/* Divider */}
          <div className="border-t border-gray-200 mx-4 my-5" />
          <ul className="flex flex-col space-y-6 px-4">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-lg text-gray-800 hover:text-green-600 font-medium"
                  onClick={handleClose}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );

  return (
    <div className="relative bg-white">
      {/* Hamburger Icon */}
      <button
        aria-label="Open navigation menu"
        className="md:hidden flex flex-col justify-center items-center w-10 h-10 focus:outline-none z-50"
        onClick={() => setOpen(true)}
      >
        <span className="block w-7 h-1 bg-gray-800 rounded mb-1 transition-all" />
        <span className="block w-7 h-1 bg-gray-800 rounded mb-1 transition-all" />
        <span className="block w-7 h-1 bg-gray-800 rounded transition-all" />
      </button>
      {mounted && (open || closing) && typeof window !== "undefined"
        ? createPortal(portalContent, document.body)
        : null}
    </div>
  );
};

export default HamburgerMenu; 