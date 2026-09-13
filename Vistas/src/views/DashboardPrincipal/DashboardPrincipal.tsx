import { solicitarFinanzas } from '../../api/finanzas';
import React, { useState, useEffect } from 'react';
import { DollarSign, Users, FileSignature, TrendingUp, AlertCircle, ShieldCheck } from 'lucide-react';

interface DashboardStats {
  clientesActivos: number;
  ingresosTotales: number;
  cotizacionesPendientes: number;
}

const DashboardPrincipal: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    solicitarFinanzas('/dashboard/stats')
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar métricas');
        return res.json();
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-12 flex justify-center items-center h-full text-gray-500">Cargando métricas...</div>;
  }

  if (error || !stats) {
    return (
      <div className="p-12 flex justify-center items-center h-full">
        <div className="bg-red-50 text-red-700 p-6 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6" />
          <span>Error: {error || 'No se pudieron cargar las estadísticas'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Bienvenido al Dashboard</h1>
        <p className="text-gray-500 mt-2">Métricas en tiempo real del módulo financiero.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        {/* Ingresos; el número grande merece respirar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Ventas vigentes (CLP)</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">
                ${stats.ingresosTotales.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
              </h3>
            </div>
            <div className="p-3 bg-green-50 rounded-xl">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-medium text-green-600 gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>Al día de hoy</span>
          </div>
        </div>

        {/* Clientes activos */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Clientes Activos</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">
                {stats.clientesActivos}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-medium text-gray-500">
            Fichas en el sistema
          </div>
        </div>

        {/* Cotizaciones abiertas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Cotizaciones Pendientes</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">
                {stats.cotizacionesPendientes}
              </h3>
            </div>
            <div className="p-3 bg-orange-50 rounded-xl">
              <FileSignature className="w-6 h-6 text-primary-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm font-medium text-gray-500">
            En estado borrador/emitida
          </div>
        </div>

      </div>

      <div className="bg-gradient-to-br from-primary-900 to-gray-900 rounded-2xl shadow-lg p-10 text-white relative overflow-hidden">
        <div className="relative z-10 max-w-xl">
          <h2 className="text-2xl font-bold mb-4">Módulo de Finanzas Operativo</h2>
          <p className="text-primary-100 leading-relaxed">
            Utiliza el menú lateral para navegar por las distintas áreas del sistema. 
            Puedes gestionar el catálogo de clientes, revisar fichas financieras individuales, 
            armar nuevas cotizaciones basadas en inventario real y emitir notas de venta directas.
          </p>
        </div>
        <div className="absolute -right-20 -bottom-20 opacity-10">
          <ShieldCheck className="w-96 h-96" />
        </div>
      </div>
    </div>
  );
};

export default DashboardPrincipal;
