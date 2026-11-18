import { useState } from 'react';
import { Check, FolderKanban, Pencil, Plus, X } from 'lucide-react';
import { BTN_PRIMARY_CLS, INPUT_CLS } from '../components/FormControls';
import { ActiveStatusIndicator } from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';
import { useCategories } from '../hooks/useMrtmisData';
import { apiClient } from '../services/apiClient';
import type { Category } from '../types/mrtmis';
import { validateCategoryInput } from '../utils/validation';

export function CategoriesPage() {
  const { categories, loading } = useCategories();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateCategoryInput({ name, description });
    if (err) {
      showToast('error', err);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.createCategory({ name, description });
      showToast('success', `Category "${name}" added.`);
      setName('');
      setDescription('');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to create category.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.categoryId);
    setEditName(cat.name);
    setEditDescription(cat.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  const saveEdit = async (categoryId: string) => {
    const err = validateCategoryInput({ name: editName, description: editDescription });
    if (err) {
      showToast('error', err);
      return;
    }
    setSavingEdit(true);
    try {
      await apiClient.updateCategory(categoryId, {
        name: editName,
        description: editDescription,
      });
      showToast('success', 'Category updated successfully.');
      cancelEdit();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update category.');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleActive = async (categoryId: string, currentActive: boolean) => {
    try {
      await apiClient.updateCategory(categoryId, { isActive: !currentActive });
      showToast('success', `Category ${!currentActive ? 'activated' : 'deactivated'}.`);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update category.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Maintenance Categories
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure organizational maintenance categories available during request intake.
          </p>
        </div>
        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap shrink-0">
          {categories.filter((c) => c.isActive).length} active of {categories.length}
        </span>
      </div>

      {/* Add Category Form */}
      <form
        onSubmit={handleCreate}
        className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 space-y-4"
      >
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">Add New Category</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Categories appear immediately in the Maintenance Request intake form when active.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="cat-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Category Name <span className="text-red-600">*</span>
            </label>
            <input
              id="cat-name"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., HVAC & Ventilation"
              className={INPUT_CLS}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cat-desc" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description
            </label>
            <input
              id="cat-desc"
              type="text"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Types of maintenance problems covered under this category"
              className={INPUT_CLS}
            />
          </div>
        </div>
        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className={BTN_PRIMARY_CLS}
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{submitting ? 'Creating...' : 'Create Category'}</span>
          </button>
        </div>
      </form>

      {/* Categories List */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-200">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
                <div className="h-3.5 w-20 bg-slate-200 rounded" />
                <div className="h-3.5 flex-1 bg-slate-200 rounded" />
                <div className="h-5 w-16 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="w-10 h-10 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <FolderKanban className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-700">No maintenance categories defined yet.</p>
            <p className="text-xs text-slate-500">Use the form above to add your first maintenance category.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {categories.map((cat) => {
                  const isEditing = editingId === cat.categoryId;
                  return (
                    <tr key={cat.categoryId} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {cat.categoryId}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {isEditing ? (
                          <input
                            type="text"
                            maxLength={80}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            aria-label="Edit category name"
                            className="w-full min-w-[160px] px-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488]"
                          />
                        ) : (
                          cat.name
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {isEditing ? (
                          <input
                            type="text"
                            maxLength={300}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            aria-label="Edit category description"
                            className="w-full min-w-[220px] px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]/25 focus-visible:border-[#0D9488]"
                          />
                        ) : (
                          cat.description || '—'
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <ActiveStatusIndicator active={cat.isActive} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={savingEdit}
                                onClick={() => saveEdit(cat.categoryId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-md transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{savingEdit ? 'Saving...' : 'Save'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
                              >
                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Cancel</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(cat)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
                              >
                                <Pencil className="w-3 h-3" aria-hidden="true" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleActive(cat.categoryId, cat.isActive)}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
                              >
                                {cat.isActive ? 'Disable' : 'Enable'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
