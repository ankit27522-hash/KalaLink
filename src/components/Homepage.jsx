import React, { useEffect, useState } from "react";
import { Mic, Search, Home, Plus, User, Sparkles } from "lucide-react";
import "./Homepage.css";

import logo from "../assets/logo.png";
import backgroundTexture from "../assets/background-texture.jpg";
import botanicalTop from "../assets/botanical-top.png";
import botanicalBottom from "../assets/botanical-bottom.png";
import { getProducts, deleteProduct } from "../utils/productsStorage.js";

export default function Homepage({
  userName = "Welcome back!",
  avatarUrl = "https://placehold.co/80x80/cccccc/333333?text=U",
  activeNav = "home",
  onSearch,
  onMicClick,
  onViewDetails,
  onNavChange,
}) {
  // No database yet -- products a user has generated live in localStorage.
  // Re-read on every mount so a product saved from KalaLinkForm shows up
  // as soon as the user navigates back here.
  const [products, setProducts] = useState(() => getProducts());
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    setProducts(getProducts());
  }, []);

  function handleViewDetails(product) {
    setSelectedProduct(product);
    onViewDetails?.(product);
  }

  function handleCloseDetails() {
    setSelectedProduct(null);
  }

  function handleDeleteProduct(product) {
    const confirmed = window.confirm(`Delete "${product.title}"? This can't be undone.`);
    if (!confirmed) return;
    const next = deleteProduct(product.id);
    setProducts(next);
    if (selectedProduct?.id === product.id) {
      setSelectedProduct(null);
    }
  }

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
          <button
            type="button"
            onClick={onMicClick}
            aria-label="Voice search"
            className="mic-button"
          >
            <Mic size={26} strokeWidth={2} />
          </button>

          <div className="greeting-row">
            <img src={avatarUrl} alt="User avatar" className="avatar" />
            <div className="greeting-text">
              <p className="greeting-namaste">Namaste,</p>
              <p className="greeting-name">{userName}</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearch?.(e.target.elements.search.value);
            }}
            className="search-form"
          >
            <div className="search-bar">
              <input
                name="search"
                type="text"
                placeholder="Search..."
                className="search-input"
              />
              <Search size={20} className="search-icon" />
            </div>
          </form>

          <h2 className="section-heading">Recent Products</h2>

          {products.length === 0 ? (
            <div className="empty-products-state">
              <Sparkles size={30} className="sparkle-accent" aria-hidden="true" />
              <p className="empty-products-title">Add your first product</p>
              <p className="empty-products-subtitle">
                Products you generate with KalaLink will show up here.
              </p>
            </div>
          ) : (
            <div className="product-list">
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.title}
                      className="product-image"
                    />
                  )}
                  <div className="product-info">
                    <h3 className="product-title">{product.title}</h3>
                    <p className="product-price">{product.price}</p>
                    <p className="product-description">{product.description}</p>
                    <div className="product-info-spacer" />
                    <div className="view-details-row">
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(product)}
                        className="delete-product-btn"
                        aria-label={`Delete ${product.title}`}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewDetails(product)}
                        className="view-details-btn"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <Sparkles size={22} className="sparkle-accent" aria-hidden="true" />
            </div>
          )}

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
            className="nav-icon-plain"
          >
            <User size={26} strokeWidth={2} />
          </button>
        </nav>

        {selectedProduct && (
          <div className="details-overlay" onClick={handleCloseDetails}>
            <div className="details-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="details-close-btn"
                onClick={handleCloseDetails}
                aria-label="Close details"
              >
                &times;
              </button>
              {selectedProduct.image && (
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.title}
                  className="details-image"
                />
              )}
              <h3 className="details-title">{selectedProduct.title}</h3>
              <p className="details-price">{selectedProduct.price}</p>
              <p className="details-description">{selectedProduct.description}</p>
              {selectedProduct.tags?.length > 0 && (
                <div className="details-tags">
                  {selectedProduct.tags.map((tag, idx) => (
                    <span key={idx} className="details-tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="details-delete-btn"
                onClick={() => handleDeleteProduct(selectedProduct)}
              >
                Delete Product
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}