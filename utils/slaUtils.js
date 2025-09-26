// utils/slaUtils.js
function computeSLACompliance(ticket, sla) {
  if (!sla) return { withinSLA: null };

  const created = new Date(ticket.created_at);
  let responseDeadline = null;
  let resolveDeadline = null;

  if (sla.response_time_hours) {
    responseDeadline = new Date(created.getTime() + sla.response_time_hours * 60 * 60 * 1000);
  }
  if (sla.resolve_time_hours) {
    resolveDeadline = new Date(created.getTime() + sla.resolve_time_hours * 60 * 60 * 1000);
  }

  return {
    responseDeadline,
    resolveDeadline,
    withinSLA: true, // for now always true, update logic later
  };
}

module.exports = { computeSLACompliance };
