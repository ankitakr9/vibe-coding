package com.stowbase.inventory.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "inventory_items")
public class InventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "location_id")
    private Integer locationId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String sku;

    @Column(nullable = false)
    private String category;

    @Column
    private String brand = "";

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "min_threshold", nullable = false)
    private Integer minThreshold = 1;

    @Column(name = "unit_value_cents", nullable = false)
    private Integer unitValueCents = 0;

    @Column(nullable = false)
    private String condition = "Good";

    @Column(nullable = false)
    private String status = "in_stock";

    @Column(name = "lent_to")
    private String lentTo = "";

    @Column(name = "serial_number")
    private String serialNumber = "";

    @Column(name = "purchase_date")
    private String purchaseDate = "";

    @Column(name = "warranty_until")
    private String warrantyUntil = "";

    @Column
    private String notes = "";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Integer getId() { return id; }
    public Integer getUserId() { return userId; }
    public void setUserId(Integer userId) { this.userId = userId; }
    public Integer getLocationId() { return locationId; }
    public void setLocationId(Integer locationId) { this.locationId = locationId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public Integer getMinThreshold() { return minThreshold; }
    public void setMinThreshold(Integer minThreshold) { this.minThreshold = minThreshold; }
    public Integer getUnitValueCents() { return unitValueCents; }
    public void setUnitValueCents(Integer unitValueCents) { this.unitValueCents = unitValueCents; }
    public String getCondition() { return condition; }
    public void setCondition(String condition) { this.condition = condition; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getLentTo() { return lentTo; }
    public void setLentTo(String lentTo) { this.lentTo = lentTo; }
    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }
    public String getPurchaseDate() { return purchaseDate; }
    public void setPurchaseDate(String purchaseDate) { this.purchaseDate = purchaseDate; }
    public String getWarrantyUntil() { return warrantyUntil; }
    public void setWarrantyUntil(String warrantyUntil) { this.warrantyUntil = warrantyUntil; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
