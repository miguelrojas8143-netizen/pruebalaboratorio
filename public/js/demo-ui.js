(function() {
    'use strict';

    function actualizarDiasRestantes() {
        if (!window.electronAPI) {
            console.warn('[demo-ui] electronAPI no disponible');
            return;
        }

        window.electronAPI.getDemoInfo().then(function(info) {
            var badge = document.getElementById('diasRestantesBadge');
            var span = document.getElementById('diasRestantes');

            if (!badge || !span) return;

            if (info.esValida && info.diasRestantes > 0) {
                span.textContent = info.diasRestantes;
                badge.classList.remove('d-none');
                badge.classList.add('bg-warning', 'text-dark');
            } else {
                badge.classList.add('d-none');
            }
        }).catch(function(err) {
            console.error('[demo-ui] Error al obtener información de demo:', err);
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        actualizarDiasRestantes();
    });

    window.electronAPI.onDemoInfo(function(info) {
        var badge = document.getElementById('diasRestantesBadge');
        var span = document.getElementById('diasRestantes');

        if (!badge || !span) return;

        if (info.esValida && info.diasRestantes > 0) {
            span.textContent = info.diasRestantes;
            badge.classList.remove('d-none');
            badge.classList.add('bg-warning', 'text-dark');
        } else {
            badge.classList.add('d-none');
        }
    });
})();
