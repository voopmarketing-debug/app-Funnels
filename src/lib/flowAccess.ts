import type { Role } from "@prisma/client";

/**
 * Who can create and edit a business's conversation flows: the owner and the
 * agency always; a salesperson (MEMBER) only while the owner leaves it on for
 * them (Mi perfil → Equipo de ventas).
 */
export function canEditFlows(role: Role, canManageFlows: boolean): boolean {
  return role !== "MEMBER" || canManageFlows;
}

export const FLOW_ACCESS_DENIED = "No tienes permiso para crear o cambiar flujos. Pídeselo al dueño del negocio.";
