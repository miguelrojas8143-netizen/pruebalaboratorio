(function() {
    'use strict';

    var NotificationSystem = {
        container: null,
        modalBackdrop: null,
        activeModal: null,
        focusStack: [],
        toasts: [],

        init: function() {
            if (this.container) return;

            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.setAttribute('role', 'region');
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-label', 'Notificaciones');
            document.body.appendChild(this.container);

            this.modalBackdrop = document.createElement('div');
            this.modalBackdrop.id = 'modal-backdrop';
            this.modalBackdrop.style.display = 'none';
            document.body.appendChild(this.modalBackdrop);

            this.bindKeyboard();
        },

        bindKeyboard: function() {
            var self = this;
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && self.activeModal) {
                    self.closeModal();
                }
            });
        },

        showToast: function(message, options) {
            var self = this;
            options = options || {};

            var toast = document.createElement('div');
            toast.className = 'toast toast-' + (options.type || 'info');
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');

            var icon = this.getIcon(options.type || 'info');
            toast.innerHTML = icon + '<span class="toast-message">' + this.escapeHtml(message) + '</span>';

            var closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.setAttribute('aria-label', 'Cerrar notificación');
            closeBtn.innerHTML = '×';
            closeBtn.addEventListener('click', function() {
                self.removeToast(toast);
            });
            toast.appendChild(closeBtn);

            this.container.appendChild(toast);
            this.toasts.push(toast);

            requestAnimationFrame(function() {
                toast.classList.add('show');
            });

            var duration = options.duration || 5000;
            if (duration > 0) {
                setTimeout(function() {
                    self.removeToast(toast);
                }, duration);
            }

            return toast;
        },

        removeToast: function(toast) {
            var self = this;
            toast.classList.remove('show');
            toast.addEventListener('transitionend', function handler() {
                toast.removeEventListener('transitionend', handler);
                toast.remove();
                var idx = self.toasts.indexOf(toast);
                if (idx > -1) self.toasts.splice(idx, 1);
            });
        },

        getIcon: function(type) {
            var icons = {
                success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
                error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
                warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
                info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
            };
            return icons[type] || icons.info;
        },

        escapeHtml: function(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        showModal: function(options) {
            var self = this;
            return new Promise(function(resolve) {
                if (self.activeModal) {
                    resolve(false);
                    return;
                }

                var modal = document.createElement('div');
                modal.className = 'custom-modal';
                modal.setAttribute('role', 'dialog');
                modal.setAttribute('aria-modal', 'true');
                modal.setAttribute('aria-labelledby', 'modal-title');
                modal.setAttribute('aria-describedby', 'modal-message');

                var iconHtml = self.getIcon(options.type || 'warning');

                modal.innerHTML =
                    '<div class="modal-content">' +
                        '<div class="modal-header">' +
                            self.getIcon(options.type || 'warning') +
                            '<h3 id="modal-title" class="modal-title">' + self.escapeHtml(options.title || 'Confirmar') + '</h3>' +
                        '</div>' +
                        '<div class="modal-body">' +
                            '<p id="modal-message">' + self.escapeHtml(options.message || '') + '</p>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                            '<button type="button" class="btn btn-secondary modal-cancel" data-result="false">' +
                                (options.cancelText || 'Cancelar') +
                            '</button>' +
                            '<button type="button" class="btn btn-primary modal-confirm" data-result="true">' +
                                (options.confirmText || 'Aceptar') +
                            '</button>' +
                        '</div>' +
                    '</div>';

                var cancelBtn = modal.querySelector('.modal-cancel');
                var confirmBtn = modal.querySelector('.modal-confirm');

                var close = function(result) {
                    self.closeModal();
                    resolve(result);
                };

                cancelBtn.addEventListener('click', function() { close(false); });
                confirmBtn.addEventListener('click', function() { close(true); });

                self.activeModal = modal;
                self.modalBackdrop.style.display = 'block';
                document.body.appendChild(modal);

                requestAnimationFrame(function() {
                    self.modalBackdrop.classList.add('show');
                    modal.classList.add('show');
                    confirmBtn.focus();
                });

                self.modalBackdrop.addEventListener('click', function handler() {
                    self.modalBackdrop.removeEventListener('click', handler);
                    close(false);
                });
            });
        },

        closeModal: function() {
            var self = this;
            if (!self.activeModal) return;

            var modal = self.activeModal;
            self.activeModal = null;

            self.modalBackdrop.classList.remove('show');
            modal.classList.remove('show');

            var finish = function() {
                modal.removeEventListener('transitionend', finish);
                modal.remove();
                if (!self.activeModal) {
                    self.modalBackdrop.style.display = 'none';
                }
            };
            modal.addEventListener('transitionend', finish);
        },

        alert: function(message, options) {
            options = options || {};
            return this.showToast(message, Object.assign({ type: 'info' }, options));
        },

        success: function(message, options) {
            options = options || {};
            return this.showToast(message, Object.assign({ type: 'success', duration: 4000 }, options));
        },

        error: function(message, options) {
            options = options || {};
            return this.showToast(message, Object.assign({ type: 'error', duration: 7000 }, options));
        },

        warning: function(message, options) {
            options = options || {};
            return this.showToast(message, Object.assign({ type: 'warning', duration: 6000 }, options));
        },

        confirm: function(messageOrOptions, options) {
            var messageStr, opts;
            if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
                opts = messageOrOptions;
                messageStr = opts.message || '';
            } else {
                messageStr = messageOrOptions || '';
                opts = options || {};
            }
            return this.showModal({
                title: opts.title || 'Confirmar',
                message: messageStr,
                type: opts.type || 'warning',
                confirmText: opts.confirmText || 'Aceptar',
                cancelText: opts.cancelText || 'Cancelar'
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            NotificationSystem.init();
        });
    } else {
        NotificationSystem.init();
    }

    window.Notifications = {
        toast: function(message, options) { return NotificationSystem.showToast(message, options); },
        alert: function(message, options) { return NotificationSystem.alert(message, options); },
        success: function(message, options) { return NotificationSystem.success(message, options); },
        error: function(message, options) { return NotificationSystem.error(message, options); },
        warning: function(message, options) { return NotificationSystem.warning(message, options); },
        confirm: function(message, options) { return NotificationSystem.confirm(message, options); }
    };

    window.showToast = function(message, options) { return NotificationSystem.showToast(message, options); };
    window.showAlert = function(message, options) { return NotificationSystem.alert(message, options); };
    window.showSuccess = function(message, options) { return NotificationSystem.success(message, options); };
    window.showError = function(message, options) { return NotificationSystem.error(message, options); };
    window.showWarning = function(message, options) { return NotificationSystem.warning(message, options); };
    window.showConfirm = function(message, options) { return NotificationSystem.confirm(message, options); };
})();