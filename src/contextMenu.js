class ContextMenu {
    constructor() {
        this.menu = document.createElement('div');
        this.menu.className = 'context-menu';
        this.menu.style.display = 'none';
        this.menu.style.position = 'fixed';
        this.menu.style.zIndex = '1000';
        this.menu.style.backgroundColor = 'white';
        this.menu.style.border = '1px solid #ccc';
        this.menu.style.padding = '5px';
        this.menu.style.borderRadius = '4px';
        this.menu.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
        document.body.appendChild(this.menu);

        // Close menu on window click
        window.addEventListener('click', () => this.hide());
    }

    show(x, y, options) {
        this.menu.innerHTML = '';
        options.forEach(option => {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.style.userSelect = 'none';
            item.style.color = option.color || '#333';
            item.textContent = option.label;

            item.addEventListener('mouseover', () => {
                item.style.backgroundColor = '#f0f0f0';
            });
            item.addEventListener('mouseout', () => {
                item.style.backgroundColor = 'transparent';
            });
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                option.action();
                this.hide();
            });

            this.menu.appendChild(item);
        });

        // Position menu and show
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
        this.menu.style.display = 'block';

        // Adjust position if menu would go off screen
        const menuRect = this.menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (menuRect.right > windowWidth) {
            this.menu.style.left = `${windowWidth - menuRect.width}px`;
        }
        if (menuRect.bottom > windowHeight) {
            this.menu.style.top = `${windowHeight - menuRect.height}px`;
        }
    }

    hide() {
        this.menu.style.display = 'none';
    }
}

export default ContextMenu;