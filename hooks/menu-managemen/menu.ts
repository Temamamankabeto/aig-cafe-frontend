import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { menuService } from "@/services/menu-management";
import { queryKeys } from "@/hooks/queryKeys";

import type {
  MenuCategoryParams,
  MenuCategoryPayload,
  MenuItemParams,
  MenuItemPayload,
  MenuMode,
  MenuRoleScope,
} from "@/types/menu-management";

const DEFAULT_SCOPE: MenuRoleScope = "admin";

/* =========================
   QUERIES
========================= */

export function useMenuCategoriesQuery(
  params: MenuCategoryParams = {},
  scope: MenuRoleScope = DEFAULT_SCOPE,
) {
  return useQuery({
    queryKey: queryKeys.menu.categories(params, scope),
    queryFn: () => menuService.categories(params, scope),
  });
}

export function useMenuItemsQuery(
  params: MenuItemParams = {},
  scope: MenuRoleScope = DEFAULT_SCOPE,
) {
  return useQuery({
    queryKey: queryKeys.menu.items(params, scope),
    queryFn: () => menuService.items(params, scope),
  });
}

/* =========================
   CATEGORY MUTATIONS
========================= */

export function useCreateMenuCategoryMutation(done?: () => void, scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MenuCategoryPayload) =>
      menuService.createCategory(payload, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Category created");
      done?.();
    },
  });
}

export function useUpdateMenuCategoryMutation(done?: () => void, scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string | number;
      payload: MenuCategoryPayload;
    }) => menuService.updateCategory(id, payload, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Category updated");
      done?.();
    },
  });
}

export function useToggleMenuCategoryMutation(scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) =>
      menuService.toggleCategory(id, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Category status updated");
    },
  });
}

export function useDeleteMenuCategoryMutation(scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) =>
      menuService.deleteCategory(id, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Category deleted");
    },
  });
}

/* =========================
   ITEM MUTATIONS
========================= */

export function useCreateMenuItemMutation(done?: () => void, scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MenuItemPayload) =>
      menuService.createItem(payload, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Menu item created");
      done?.();
    },
  });
}

export function useUpdateMenuItemMutation(done?: () => void, scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string | number;
      payload: MenuItemPayload;
    }) => menuService.updateItem(id, payload, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Menu item updated");
      done?.();
    },
  });
}

export function useToggleMenuItemMutation(scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) =>
      menuService.toggleItem(id, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Menu item status updated");
    },
  });
}

export function useMenuItemAvailabilityMutation(scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      isAvailable,
    }: {
      id: string | number;
      isAvailable: boolean;
    }) => menuService.availability(id, isAvailable, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Menu item availability updated");
    },
  });
}

export function useSetMenuItemModeMutation(scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      mode,
    }: {
      id: string | number;
      mode: MenuMode;
    }) =>
      mode === "spatial"
        ? menuService.spatial(id, scope)
        : menuService.normal(id, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Menu item mode updated");
    },
  });
}

export function useDeleteMenuItemMutation(scope: MenuRoleScope = DEFAULT_SCOPE) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) =>
      menuService.deleteItem(id, scope),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menu.root(),
      });

      toast.success("Menu item deleted");
    },
  });
}