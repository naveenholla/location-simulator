import { DragControls } from 'three/examples/jsm/controls/DragControls';

class DragControlsManager {
    constructor(camera, domElement, wsManager) {
        this.camera = camera;
        this.domElement = domElement;
        this.wsManager = wsManager;
        this.dragControls = null;
        this.objects = [];
        this.isDragging = false;
        this.dragStartPosition = null;
    }

    addObject(object) {
        this.objects.push(object);
        if (this.dragControls) {
            this.dragControls.dispose();
        }
        this.setupDragControls();
    }

    removeObject(object) {
        const index = this.objects.indexOf(object);
        if (index !== -1) {
            this.objects.splice(index, 1);
            if (this.dragControls) {
                this.dragControls.dispose();
            }
            this.setupDragControls();
        }
    }

    setupDragControls() {
        this.dragControls = new DragControls(this.objects, this.camera, this.domElement);

        this.dragControls.addEventListener('dragstart', (event) => {
            this.isDragging = true;
            this.dragStartPosition = event.object.position.clone();
            // Disable text selection during drag
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none';
            document.body.style.mozUserSelect = 'none';
            document.body.style.msUserSelect = 'none';
        });

        this.dragControls.addEventListener('drag', (event) => {
            // Constrain movement to the xz plane (floor)
            event.object.position.y = this.dragStartPosition.y;
        });

        this.dragControls.addEventListener('dragend', (event) => {
            this.isDragging = false;
            const object = event.object;
            const position = object.position;

            // Re-enable text selection after drag
            document.body.style.userSelect = '';
            document.body.style.webkitUserSelect = '';
            document.body.style.mozUserSelect = '';
            document.body.style.msUserSelect = '';

            // Update position in backend
            if (object.userData.type === 'AP') {
                this.wsManager.updateAPPosition(object.userData.id, position);
            } else if (object.userData.type === 'Client') {
                this.wsManager.updateClientPosition(object.userData.id, position);
            }
        });
    }

    dispose() {
        if (this.dragControls) {
            this.dragControls.dispose();
        }
    }
}

export default DragControlsManager;