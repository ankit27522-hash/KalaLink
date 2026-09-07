import React, { useEffect, useState } from "react";
import { Home, Plus, User, Wallet, TrendingUp, Package } from "lucide-react";
import "./ProfilePage.css";

import logo from "../assets/logo.png";
import backgroundTexture from "../assets/background-texture.jpg";
import botanicalTop from "../assets/botanical-top.png";
import botanicalBottom from "../assets/botanical-bottom.png";
import { getProducts } from "../utils/productsStorage.js";

export default function ProfilePage({
  name = "Ankit kumar",
  role = "Artisan, Handmade Crafts",
  avatarUrl = "https://placehold.co/200x200/cccccc/333333?text=U",
  // Total earnings/profits need real sales data, which doesn't exist
  // without a database yet -- these stay at their placeholder default.
  totalEarnings = "₹0",
  totalProfits = "₹0",
  activeNav = "profile",
  onNavChange,
  onSalesAnalyticsClick,
}) {
  // Products uploaded and the top-products row ARE derivable from what's
  // already in localStorage, so pull those in on mount.
  const [products, setProducts] = useState(() => getProducts());

  useEffect(() => {
    setProducts(getProducts());
  }, []);

  const productsUploaded = products.length;
  const topProducts = products.slice(0, 3);

  return (
    <div className="page-wrapper">
      <div className="app-shell">
        {/* Header */}
        <div
          className="header"
          style={{ backgroundImage: `url(${backgroundTexture})` }}
        >
          <img
            src={botanicalTop}
            alt=""
            aria-hidden="true"
            className="botanical-top"
          />
          <div className="logo-wrap">
            <img src={logo} alt="KalaLink" className="logo-img" draggable={false} />
          </div>
        </div>

        {/* Body panel */}
        <div className="body-panel">
          <h2 className="profile-heading">Profile: {name}</h2>

          <div className="avatar-frame-wrap">
            <img src={avatarUrl} alt={name} className="profile-avatar" />
          </div>

          <p className="profile-role">{role}</p>

          <h2 className="section-heading centered">Seller Statistics</h2>
          <div className="stat-divider" aria-hidden="true">
            <span className="stat-divider-line" />
            <span className="stat-divider-diamond">◆◇◆</span>
            <span className="stat-divider-line" />
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <Wallet size={28} className="stat-icon" />
              <p className="stat-label">Total Earnings</p>
              <p className="stat-value">{totalEarnings}</p>
            </div>
            <div className="stat-card">
              <TrendingUp size={28} className="stat-icon" />
              <p className="stat-label">Total Profits</p>
              <p className="stat-value">{totalProfits}</p>
            </div>
            <div className="stat-card">
              <Package size={28} className="stat-icon" />
              <p className="stat-label">Products Uploaded</p>
              <p className="stat-value">{productsUploaded}</p>
            </div>
          </div>

          <h2 className="section-heading">Top Performing Products</h2>

          <div className="top-products-row">
            {topProducts.length === 0 ? (
              <p className="empty-products">No products yet</p>
            ) : (
              topProducts.map((product) => (
                <div key={product.id} className="top-product-card">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.title}
                      className="top-product-image"
                    />
                  )}
                  <p className="top-product-title">{product.title}</p>
                </div>
              ))
            )}
          </div>

          <div className="analytics-btn-row">
            <button
              type="button"
              onClick={onSalesAnalyticsClick}
              className="analytics-btn"
            >
              Sales Analytics
            </button>
          </div>

          <img
            src={botanicalBottom}
            alt=""
            aria-hidden="true"
            className="botanical-bottom"
          />

          <div className="bottom-spacer" />
        </div>

        {/* Bottom nav */}
        <nav className="bottom-nav">
          <button
            type="button"
            onClick={() => onNavChange?.("home")}
            aria-label="Home"
            className={`nav-icon ${activeNav === "home" ? "nav-icon-active" : "nav-icon-inactive"}`}
          >
            <Home size={26} fill="currentColor" strokeWidth={0} />
          </button>
          <button
            type="button"
            onClick={() => onNavChange?.("add")}
            aria-label="Add"
            className="nav-icon-plain"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => onNavChange?.("profile")}
            aria-label="Profile"
            className={`nav-icon ${activeNav === "profile" ? "nav-icon-active" : "nav-icon-inactive"}`}
          >
            <User size={26} strokeWidth={activeNav === "profile" ? 0 : 2} fill={activeNav === "profile" ? "currentColor" : "none"} />
          </button>
        </nav>
      </div>
    </div>
  );
}