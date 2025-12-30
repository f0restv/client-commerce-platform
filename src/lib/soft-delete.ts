/**
 * Soft Delete Utilities
 *
 * Provides helpers for working with soft-deleted records.
 * Tables with soft delete: User, Client, Product, Order, Submission
 *
 * Usage:
 *   import { softDelete, withoutDeleted } from '@/lib/soft-delete';
 *
 *   // Soft delete a product
 *   await softDelete.product(productId);
 *
 *   // Query only active products
 *   const products = await db.product.findMany({
 *     where: withoutDeleted(),
 *   });
 *
 *   // Include deleted in query (for admin views)
 *   const allProducts = await db.product.findMany({
 *     where: withDeleted(),
 *   });
 *
 *   // Restore a soft-deleted record
 *   await restore.product(productId);
 */

import { db } from './db';

/**
 * Filter clause to exclude soft-deleted records.
 * Use in Prisma `where` clauses.
 */
export function withoutDeleted() {
  return { deletedAt: null };
}

/**
 * Filter clause to include all records (including deleted).
 * Use in Prisma `where` clauses for admin views.
 */
export function withDeleted() {
  return {};
}

/**
 * Filter clause to show only deleted records.
 * Useful for "trash" views.
 */
export function onlyDeleted() {
  return { deletedAt: { not: null } };
}

/**
 * Check if a record is soft-deleted.
 */
export function isDeleted(record: { deletedAt: Date | null }): boolean {
  return record.deletedAt !== null;
}

/**
 * Soft delete operations for each model.
 */
export const softDelete = {
  async user(id: string) {
    return db.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async client(id: string) {
    return db.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async product(id: string) {
    return db.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async order(id: string) {
    return db.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async submission(id: string) {
    return db.submission.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};

/**
 * Restore (un-delete) operations for each model.
 */
export const restore = {
  async user(id: string) {
    return db.user.update({
      where: { id },
      data: { deletedAt: null },
    });
  },

  async client(id: string) {
    return db.client.update({
      where: { id },
      data: { deletedAt: null },
    });
  },

  async product(id: string) {
    return db.product.update({
      where: { id },
      data: { deletedAt: null },
    });
  },

  async order(id: string) {
    return db.order.update({
      where: { id },
      data: { deletedAt: null },
    });
  },

  async submission(id: string) {
    return db.submission.update({
      where: { id },
      data: { deletedAt: null },
    });
  },
};

/**
 * Hard delete (permanently remove) - use with caution!
 * Only for admin/cleanup operations.
 */
export const hardDelete = {
  async user(id: string) {
    return db.user.delete({ where: { id } });
  },

  async client(id: string) {
    return db.client.delete({ where: { id } });
  },

  async product(id: string) {
    return db.product.delete({ where: { id } });
  },

  async order(id: string) {
    return db.order.delete({ where: { id } });
  },

  async submission(id: string) {
    return db.submission.delete({ where: { id } });
  },
};

export default {
  softDelete,
  restore,
  hardDelete,
  withoutDeleted,
  withDeleted,
  onlyDeleted,
  isDeleted,
};
