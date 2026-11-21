package com.stowbase.inventory.controller;

import com.stowbase.inventory.model.InventoryItem;
import com.stowbase.inventory.repository.InventoryItemRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@RestController
@RequestMapping("/api")
public class InventoryController {

    private final InventoryItemRepository itemRepository;
    private final Map<String, Set<SseEmitter>> userStreams = new ConcurrentHashMap<>();

    public InventoryController(InventoryItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    public record AdjustRequest(
            @NotNull @Min(-100000) @Max(100000) Integer delta,
            String note
    ) {}

    public record CreateItemRequest(
            @NotBlank String name,
            String sku,
            @NotBlank String category,
            String brand,
            Integer locationId,
            @NotNull @Min(0) Integer quantity,
            @NotNull @Min(0) Integer minThreshold,
            @NotNull @Min(0) Integer unitValueCents,
            String condition
    ) {}

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(HttpServletRequest request) {
        String uid = (String) request.getAttribute("firebaseUid");
        SseEmitter emitter = new SseEmitter(0L);
        userStreams.computeIfAbsent(uid, k -> new CopyOnWriteArraySet<>()).add(emitter);

        Runnable cleanup = () -> {
            Set<SseEmitter> emitters = userStreams.get(uid);
            if (emitters != null) {
                emitters.remove(emitter);
            }
        };
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(e -> cleanup.run());

        try {
            emitter.send(SseEmitter.event().data(Map.of(
                    "type", "connected",
                    "timestamp", Instant.now().toString()
            )));
        } catch (IOException ignored) {
            cleanup.run();
        }
        return emitter;
    }

    @GetMapping("/items")
    public Map<String, Object> listItems(
            HttpServletRequest request,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String locationId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) Integer minValueCents,
            @RequestParam(required = false) Integer maxValueCents,
            @RequestParam(defaultValue = "updatedAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        Integer userId = (Integer) request.getAttribute("dbUserId");

        Specification<InventoryItem> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("userId"), userId));

            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("sku")), pattern),
                        cb.like(cb.lower(root.get("brand")), pattern),
                        cb.like(cb.lower(root.get("category")), pattern),
                        cb.like(cb.lower(root.get("serialNumber")), pattern),
                        cb.like(cb.lower(root.get("notes")), pattern)
                ));
            }
            if (category != null && !category.isBlank() && !"all".equalsIgnoreCase(category)) {
                predicates.add(cb.equal(root.get("category"), category.trim()));
            }
            if (condition != null && !condition.isBlank() && !"all".equalsIgnoreCase(condition)) {
                predicates.add(cb.equal(root.get("condition"), condition.trim()));
            }
            if (locationId != null && !locationId.isBlank()) {
                if ("unassigned".equalsIgnoreCase(locationId)) {
                    predicates.add(cb.isNull(root.get("locationId")));
                } else {
                    predicates.add(cb.equal(root.get("locationId"), Integer.valueOf(locationId)));
                }
            }
            if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
                if ("needs_restock".equals(status)) {
                    predicates.add(root.get("status").in(List.of("low_stock", "out_of_stock")));
                } else {
                    predicates.add(cb.equal(root.get("status"), status.trim()));
                }
            }
            if (minValueCents != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("unitValueCents"), minValueCents));
            }
            if (maxValueCents != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("unitValueCents"), maxValueCents));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        String sortField = switch (sortBy) {
            case "name" -> "name";
            case "quantity" -> "quantity";
            case "unitValue", "totalValue" -> "unitValueCents";
            case "category" -> "category";
            default -> "updatedAt";
        };
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        List<InventoryItem> items = itemRepository.findAll(spec, Sort.by(direction, sortField));
        return Map.of("items", items, "filteredCount", items.size());
    }

    @PostMapping("/items")
    @Transactional
    public ResponseEntity<Map<String, InventoryItem>> createItem(
            HttpServletRequest request,
            @Valid @RequestBody CreateItemRequest body
    ) {
        Integer userId = (Integer) request.getAttribute("dbUserId");
        String uid = (String) request.getAttribute("firebaseUid");

        InventoryItem item = new InventoryItem();
        item.setUserId(userId);
        item.setName(body.name().trim());
        item.setSku(body.sku() != null && !body.sku().isBlank()
                ? body.sku().trim()
                : "INV-" + System.currentTimeMillis() % 100000);
        item.setCategory(body.category().trim());
        item.setBrand(body.brand() == null ? "" : body.brand().trim());
        item.setLocationId(body.locationId());
        item.setQuantity(body.quantity());
        item.setMinThreshold(body.minThreshold());
        item.setUnitValueCents(body.unitValueCents());
        item.setCondition(body.condition() == null ? "Good" : body.condition().trim());
        item.setStatus(deriveStatus(body.quantity(), body.minThreshold(), null));
        item.setUpdatedAt(Instant.now());

        InventoryItem saved = itemRepository.save(item);
        broadcast(uid, "created");
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("item", saved));
    }

    @PostMapping("/items/{id}/adjust")
    @Transactional
    public ResponseEntity<?> adjustQuantity(
            HttpServletRequest request,
            @PathVariable Integer id,
            @Valid @RequestBody AdjustRequest body
    ) {
        Integer userId = (Integer) request.getAttribute("dbUserId");
        String uid = (String) request.getAttribute("firebaseUid");

        return itemRepository.findByIdAndUserId(id, userId)
                .map(item -> {
                    int nextQty = Math.max(0, item.getQuantity() + body.delta());
                    item.setQuantity(nextQty);
                    item.setStatus(deriveStatus(nextQty, item.getMinThreshold(), item.getStatus()));
                    item.setUpdatedAt(Instant.now());
                    InventoryItem saved = itemRepository.save(item);
                    broadcast(uid, "adjusted");
                    return ResponseEntity.ok(Map.of("item", saved));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Item not found.")));
    }

    @DeleteMapping("/items/{id}")
    @Transactional
    public ResponseEntity<?> deleteItem(HttpServletRequest request, @PathVariable Integer id) {
        Integer userId = (Integer) request.getAttribute("dbUserId");
        String uid = (String) request.getAttribute("firebaseUid");

        return itemRepository.findByIdAndUserId(id, userId)
                .map(item -> {
                    itemRepository.delete(item);
                    broadcast(uid, "deleted");
                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Item not found.")));
    }

    private String deriveStatus(int quantity, int minThreshold, String existingStatus) {
        if ("lent_out".equals(existingStatus)) return "lent_out";
        if (quantity <= 0) return "out_of_stock";
        if (quantity <= minThreshold) return "low_stock";
        return "in_stock";
    }

    private void broadcast(String uid, String action) {
        Set<SseEmitter> emitters = userStreams.get(uid);
        if (emitters == null) return;
        Map<String, String> payload = Map.of(
                "type", "inventory_updated",
                "action", action,
                "timestamp", Instant.now().toString()
        );
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().data(payload));
            } catch (IOException ex) {
                emitters.remove(emitter);
            }
        }
    }
}
