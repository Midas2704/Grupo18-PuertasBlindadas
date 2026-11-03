// Compatibility entry point. Database writes require explicit isolated-test opt-in.
// The former automatic clean assertions were unsafe for immutable M9 evidence.
require('./demo-historico.test.cjs');
require('./demo-historico.integration.cjs');
