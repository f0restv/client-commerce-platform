"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, Check, FolderPlus, Loader2 } from "lucide-react";

interface Collection {
  id: string;
  name: string;
  hasProduct: boolean;
}

interface AddToCollectionModalProps {
  productId: string;
  productTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AddToCollectionModal({
  productId,
  productTitle,
  isOpen,
  onClose,
}: AddToCollectionModalProps) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch collections when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCollections();
    }
  }, [isOpen, productId]);

  const fetchCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}/collections`);
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections);
      }
    } catch (error) {
      console.error("Failed to fetch collections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });

      if (res.ok) {
        const { collection } = await res.json();
        // Add to collection immediately
        await handleToggleCollection(collection.id, false);
        setNewCollectionName("");
        setShowCreateForm(false);
        fetchCollections();
      }
    } catch (error) {
      console.error("Failed to create collection:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleCollection = async (collectionId: string, hasProduct: boolean) => {
    setActionLoading(collectionId);
    try {
      if (hasProduct) {
        // Remove from collection
        const res = await fetch(
          `/api/collections/${collectionId}/items?itemId=${productId}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          setCollections((prev) =>
            prev.map((c) =>
              c.id === collectionId ? { ...c, hasProduct: false } : c
            )
          );
        }
      } else {
        // Add to collection
        const res = await fetch(`/api/collections/${collectionId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });
        if (res.ok) {
          setCollections((prev) =>
            prev.map((c) =>
              c.id === collectionId ? { ...c, hasProduct: true } : c
            )
          );
        }
      }
    } catch (error) {
      console.error("Failed to update collection:", error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save to Collection</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="mb-4 text-sm text-gray-500 line-clamp-1">
            {productTitle}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() =>
                    handleToggleCollection(collection.id, collection.hasProduct)
                  }
                  disabled={actionLoading === collection.id}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                    collection.hasProduct
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <span className="font-medium">{collection.name}</span>
                  {actionLoading === collection.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : collection.hasProduct ? (
                    <Check className="h-5 w-5 text-amber-600" />
                  ) : (
                    <Plus className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              ))}

              {collections.length === 0 && !showCreateForm && (
                <p className="py-4 text-center text-sm text-gray-500">
                  You don&apos;t have any collections yet.
                </p>
              )}
            </div>
          )}

          {/* Create new collection */}
          {showCreateForm ? (
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Collection name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                autoFocus
              />
              <Button
                onClick={handleCreateCollection}
                disabled={creating || !newCollectionName.trim()}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewCollectionName("");
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => setShowCreateForm(true)}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Create New Collection
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simpler button for product cards
interface AddToCollectionButtonProps {
  productId: string;
  productTitle: string;
  className?: string;
}

export function AddToCollectionButton({
  productId,
  productTitle,
  className,
}: AddToCollectionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={cn(
          "rounded-full bg-white/80 p-2 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:shadow-md",
          className
        )}
        aria-label="Save to collection"
      >
        <FolderPlus className="h-4 w-4" />
      </button>
      <AddToCollectionModal
        productId={productId}
        productTitle={productTitle}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
