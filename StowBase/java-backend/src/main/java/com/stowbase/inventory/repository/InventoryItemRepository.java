package com.stowbase.inventory.repository;

import com.stowbase.inventory.model.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.List;
import java.util.Optional;

public interface InventoryItemRepository
        extends JpaRepository<InventoryItem, Integer>, JpaSpecificationExecutor<InventoryItem> {
    List<InventoryItem> findByUserIdOrderByUpdatedAtDesc(Integer userId);
    Optional<InventoryItem> findByIdAndUserId(Integer id, Integer userId);
}
