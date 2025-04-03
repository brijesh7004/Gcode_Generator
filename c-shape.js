(function() {
    let currentScale = 2;
    const minScale = 0.5;
    const maxScale = 10;
    let scene, camera, renderer, controls, line3D, startPoint, endPoint;
    let isSceneInitialized = false;
    let generatedGcode = '';
    
    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('visualization');
        const ctx = canvas.getContext('2d');
        const generateBtn = document.getElementById('generateBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const resetBtn = document.getElementById('resetBtn');
        const gcodeOutput = document.getElementById('gcodeOutput');
        const view2DBtn = document.getElementById('view2D');
        const view3DBtn = document.getElementById('view3D');
        const zoomInBtn = document.getElementById('zoomIn');
        const zoomOutBtn = document.getElementById('zoomOut');
        const resetZoomBtn = document.getElementById('resetZoom');
        const visualization3d = document.getElementById('visualization3d');
        const viewAngles = document.getElementById('viewAngles');
        
        // Input elements
        const innerRadius = document.getElementById('innerRadius');
        const outerRadius = document.getElementById('outerRadius');
        const startAngle = document.getElementById('startAngle');
        const endAngle = document.getElementById('endAngle');
        const toolDiameter = document.getElementById('toolDiameter');
        const toolSpeed = document.getElementById('toolSpeed');
        const totalDepth = document.getElementById('totalDepth');
        const stepDepth = document.getElementById('stepDepth');
        const feedrateCut = document.getElementById('feedrateCut');
        const feedrateMove = document.getElementById('feedrateMove');

        // Canvas settings
        canvas.width = 500;
        canvas.height = 400;
        
        function drawVisualization() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            
            // Move to center and scale
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(currentScale, currentScale);
            
            // Draw grid
            drawGrid(ctx);
            
            // Get parameters
            const inner = parseFloat(innerRadius.value);
            const outer = parseFloat(outerRadius.value);
            const start = parseFloat(startAngle.value);
            const end = parseFloat(endAngle.value);
            const tool = parseFloat(toolDiameter.value);
            const stepVal = tool * 0.8; // Step over is 80% of tool diameter
            
            // Adjust radii for tool diameter
            const adjustedInner = inner + (tool/2);
            const adjustedOuter = outer - (tool/2);
            
            // Calculate number of passes
            const numPasses = Math.ceil((adjustedOuter - adjustedInner) / stepVal);
            
            // Draw cutting paths
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 1;
            
            // Convert angles to radians and calculate remaining circle
            const lowerArc = Math.min(start, end);
            const higherArc = Math.max(start, end);
            const remainStart = higherArc * Math.PI / 180;
            const remainEnd = lowerArc < 0 ? 
                Math.PI * 2 + (lowerArc * Math.PI / 180) : 
                Math.PI * 2 - Math.abs(lowerArc * Math.PI / 180);
            
            // Draw each cutting pass
            for (let i = 0; i <= numPasses; i++) {
                let radius = adjustedInner + (i * stepVal);
                if (radius > adjustedOuter) {
                    radius = adjustedOuter;
                }
                
                // Draw remaining circle arc
                ctx.beginPath();
                ctx.arc(0, 0, radius, remainStart, remainEnd);
                ctx.stroke();
                
                // Draw entry/exit lines
                if (i === 0 || i === numPasses || radius === adjustedOuter) {
                    ctx.beginPath();
                    ctx.moveTo(radius * Math.cos(remainStart), radius * Math.sin(remainStart));
                    ctx.lineTo((radius + 5) * Math.cos(remainStart), (radius + 5) * Math.sin(remainStart));
                    ctx.stroke();
                    
                    ctx.beginPath();
                    ctx.moveTo(radius * Math.cos(remainEnd), radius * Math.sin(remainEnd));
                    ctx.lineTo((radius + 5) * Math.cos(remainEnd), (radius + 5) * Math.sin(remainEnd));
                    ctx.stroke();
                }
            }
            
            // Draw tool path direction indicators
            const midRadius = (adjustedInner + adjustedOuter) / 2;
            const midAngle = (remainStart + remainEnd) / 2;
            const arrowSize = 2;
            
            // Draw direction arrow
            ctx.beginPath();
            ctx.moveTo(
                midRadius * Math.cos(midAngle),
                midRadius * Math.sin(midAngle)
            );
            ctx.lineTo(
                (midRadius + arrowSize) * Math.cos(midAngle - 0.1),
                (midRadius + arrowSize) * Math.sin(midAngle - 0.1)
            );
            ctx.lineTo(
                (midRadius + arrowSize) * Math.cos(midAngle + 0.1),
                (midRadius + arrowSize) * Math.sin(midAngle + 0.1)
            );
            ctx.closePath();
            ctx.fillStyle = '#e74c3c';
            ctx.fill();
            
            ctx.restore();
        }
        
        function drawGrid(ctx) {
            const gridSize = 10;
            const numLines = 20;
            
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 0.5;
            
            for (let i = -numLines; i <= numLines; i++) {
                // Vertical lines
                ctx.beginPath();
                ctx.moveTo(i * gridSize, -numLines * gridSize);
                ctx.lineTo(i * gridSize, numLines * gridSize);
                ctx.stroke();
                
                // Horizontal lines
                ctx.beginPath();
                ctx.moveTo(-numLines * gridSize, i * gridSize);
                ctx.lineTo(numLines * gridSize, i * gridSize);
                ctx.stroke();
            }
            
            // Draw axes
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            
            // X-axis
            ctx.beginPath();
            ctx.moveTo(-numLines * gridSize, 0);
            ctx.lineTo(numLines * gridSize, 0);
            ctx.stroke();
            
            // Y-axis
            ctx.beginPath();
            ctx.moveTo(0, -numLines * gridSize);
            ctx.lineTo(0, numLines * gridSize);
            ctx.stroke();
        }
        
        function generateGCode() {
            const data = {
                innerRadius: parseFloat(innerRadius.value) + parseFloat(toolDiameter.value)/2,
                outerRadius: parseFloat(outerRadius.value) - parseFloat(toolDiameter.value)/2,
                startAngle: parseFloat(startAngle.value),
                endAngle: parseFloat(endAngle.value),
                toolDiameter: parseFloat(toolDiameter.value),
                totalDepth: parseFloat(totalDepth.value),
                stepDepth: parseFloat(stepDepth.value),
                feedrateCut: parseFloat(feedrateCut.value),
                feedrateMove: parseFloat(feedrateMove.value),
                toolSpeed: parseFloat(toolSpeed.value)
            };
            
            const gcode = [];
            const format = (num) => num.toFixed(6);
            
            // Initial setup
            gcode.push('G21 ; Set units to mm');
            gcode.push('G90 ; Absolute positioning');
            gcode.push(`S${data.toolSpeed} M3 ; Set tool speed and start spindle`);
            gcode.push(`G0 Z5 F${data.feedrateMove}; Raise tool`);
            
            const lowerArc = Math.min(data.startAngle, data.endAngle);
            const higherArc = Math.max(data.startAngle, data.endAngle);
            
            const lowerRad = lowerArc * Math.PI / 180;
            const higherRad = higherArc * Math.PI / 180;
            
            const stepOver = data.toolDiameter * 0.8;
            const numPasses = Math.floor((data.outerRadius - data.innerRadius) / stepOver) + 1;
            const depthPasses = Math.ceil(data.totalDepth / data.stepDepth);
            
            for (let depth = 0; depth <= depthPasses; depth++) {
                let currentDepth = depth === 0 ? 0 : -depth * data.stepDepth;
                if (Math.abs(currentDepth) > Math.abs(data.totalDepth)) {
                    currentDepth = -data.totalDepth;
                }
                
                gcode.push('\n\n;=================================================================');
                gcode.push(`;============ Cutting depth at ${format(currentDepth)} ===================`);
                gcode.push(';=================================================================\n');
                
                const remainStart = higherRad;
                const remainEnd = lowerArc < 0 ? 
                    Math.PI * 2 + lowerRad : 
                    Math.PI * 2 - Math.abs(lowerRad);
                
                let isCloseLoop = false;
                for (let i = 0; i <= numPasses; i++) {
                    let radius = data.innerRadius + i * stepOver;
                    if (radius > data.outerRadius) {
                        radius = data.outerRadius;
                        isCloseLoop = true;
                    }
                    
                    gcode.push(`\n; Cutting C-Shape for radius of ${format(radius)}`);
                    gcode.push(`G0 X${format(radius * Math.cos(remainStart))} Y${format(radius * Math.sin(remainStart))} F${data.feedrateMove}`);
                    gcode.push(`G1 Z${format(currentDepth)} F${data.feedrateCut} ; Lower tool`);
                    
                    // Generate points along the arc
                    const numPoints = 100;
                    const angleStep = (remainEnd - remainStart) / (numPoints - 1);
                    for (let j = 0; j < numPoints; j++) {
                        const angle = remainStart + j * angleStep;
                        const x = radius * Math.cos(angle);
                        const y = radius * Math.sin(angle);
                        gcode.push(`G1 X${format(x)} Y${format(y)} F${data.feedrateCut}`);
                    }
                    
                    gcode.push(`G0 Z5 F${data.feedrateMove}; Raise tool`);
                    
                    if (isCloseLoop) break;
                }
            }
            
            gcode.push('M05 ; Stop spindle');
            gcode.push(`G0 Z5 F${data.feedrateMove}; Raise tool`);
            
            generatedGcode = gcode.join('\n');
            gcodeOutput.textContent = generatedGcode;
        }

        function downloadGCode() {
            if (!generatedGcode) {
                alert('Please generate G-code first!');
                return;
            }
            
            const blob = new Blob([generatedGcode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '');
            const a = document.createElement('a');
            a.href = url;
            a.download = `c_shape_gcode_${timestamp}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        function reset() {
            innerRadius.value = '10';
            outerRadius.value = '20';
            startAngle.value = '0';
            endAngle.value = '180';
            toolDiameter.value = '3';
            toolSpeed.value = '1000';
            totalDepth.value = '5';
            stepDepth.value = '0.2';
            feedrateCut.value = '100';
            feedrateMove.value = '1000';
            
            gcodeOutput.textContent = 'Generated G-code will appear here...';
            drawVisualization();
            if (view3DBtn.classList.contains('active')) {
                update3DVisualization();
            }
        }
        
        // Event listeners
        generateBtn.addEventListener('click', generateGCode);
        downloadBtn.addEventListener('click', downloadGCode);
        resetBtn.addEventListener('click', reset);
        
        // Add input event listeners for live visualization updates
        [innerRadius, outerRadius, startAngle, endAngle, toolDiameter].forEach(input => {
            input.addEventListener('input', () => {
                drawVisualization();
                if (view3DBtn.classList.contains('active')) {
                    update3DVisualization();
                }
            });
        });
        
        // Initialize visualization
        drawVisualization();

        // View toggle handlers with proper button references
        const topViewBtn = document.getElementById('topViewBtn');
        const side1ViewBtn = document.getElementById('side1ViewBtn');
        const side2ViewBtn = document.getElementById('side2ViewBtn');
        
        view2DBtn.addEventListener('click', () => {
            view2DBtn.classList.add('active');
            view3DBtn.classList.remove('active');
            canvas.classList.add('canvas-active');
            canvas.classList.remove('canvas-hidden');
            visualization3d.classList.add('canvas-hidden');
            visualization3d.classList.remove('canvas-active');
            viewAngles.style.display = 'none';
        });

        view3DBtn.addEventListener('click', () => {
            view3DBtn.classList.add('active');
            view2DBtn.classList.remove('active');
            canvas.classList.add('canvas-hidden');
            canvas.classList.remove('canvas-active');
            visualization3d.classList.add('canvas-active');
            visualization3d.classList.remove('canvas-hidden');
            viewAngles.style.display = 'block';
            if (!isSceneInitialized) {
                init3DScene();
            }
            update3DVisualization();
        });

        // View angle button handlers
        topViewBtn.addEventListener('click', () => {
            const position = new THREE.Vector3(0, 0, 40);
            const up = new THREE.Vector3(0, 1, 0);
            animateCamera(position, up);
        });

        side1ViewBtn.addEventListener('click', () => {
            const position = new THREE.Vector3(40, 0, 0);
            const up = new THREE.Vector3(0, 0, 1);
            animateCamera(position, up);
        });

        side2ViewBtn.addEventListener('click', () => {
            const position = new THREE.Vector3(0, 40, 0);
            const up = new THREE.Vector3(0, 0, 1);
            animateCamera(position, up);
        });
    });

    function init3DScene() {
        if (!isSceneInitialized) {
            const container = document.getElementById('visualization3d');
            
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000000);
            
            camera = new THREE.PerspectiveCamera(
                60,
                container.offsetWidth / container.offsetHeight,
                0.1,
                1000
            );
            
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(container.offsetWidth, container.offsetHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            container.innerHTML = '';
            container.appendChild(renderer.domElement);
            
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.screenSpacePanning = true;
            
            // Set initial camera position
            camera.position.set(30, 30, 30);
            camera.lookAt(0, 0, 0);
            
            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
            scene.add(ambientLight);
            
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(30, 30, 30);
            scene.add(directionalLight);
            
            // Add grid
            const gridHelper = new THREE.GridHelper(40, 20, 0xff6600, 0xff6600);
            gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
            scene.add(gridHelper);
            
            // Add axes
            const axesHelper = new THREE.AxesHelper(20);
            scene.add(axesHelper);
            
            // Animation loop
            function animate() {
                requestAnimationFrame(animate);
                controls.update();
                renderer.render(scene, camera);
            }
            animate();
            
            // Handle window resize
            window.addEventListener('resize', onWindowResize, false);
            
            isSceneInitialized = true;
        }
        
        // Clear existing scene objects except lights and helpers
        const objectsToRemove = [];
        scene.traverse((object) => {
            if (object instanceof THREE.Line || object instanceof THREE.Mesh) {
                if (!(object instanceof THREE.GridHelper || object instanceof THREE.AxesHelper)) {
                    objectsToRemove.push(object);
                }
            }
        });
        objectsToRemove.forEach(obj => scene.remove(obj));
    }

    function update3DVisualization() {
        if (!isSceneInitialized) {
            init3DScene();
        }
        
        // Remove existing geometry
        if (line3D) scene.remove(line3D);
        if (startPoint) scene.remove(startPoint);
        if (endPoint) scene.remove(endPoint);
        
        const inner = parseFloat(innerRadius.value) + parseFloat(toolDiameter.value)/2;
        const outer = parseFloat(outerRadius.value) - parseFloat(toolDiameter.value)/2;
        const start = parseFloat(startAngle.value);
        const end = parseFloat(endAngle.value);
        const depthVal = parseFloat(totalDepth.value);
        const stepVal = parseFloat(stepDepth.value);
        
        const points = [];
        const stepOver = parseFloat(toolDiameter.value) * 0.8;
        const numPasses = Math.floor((outer - inner) / stepOver) + 1;
        const depthPasses = Math.ceil(depthVal / stepVal);
        
        // Calculate remaining circle angles
        const lowerArc = Math.min(start, end);
        const higherArc = Math.max(start, end);
        const remainStart = higherArc * Math.PI / 180;
        const remainEnd = lowerArc < 0 ? 
            Math.PI * 2 + (lowerArc * Math.PI / 180) : 
            Math.PI * 2 - Math.abs(lowerArc * Math.PI / 180);
        
        // Generate points for each depth pass
        for (let depth = 0; depth <= depthPasses; depth++) {
            let currentDepth = depth === 0 ? 0 : -depth * stepVal;
            if (Math.abs(currentDepth) > Math.abs(depthVal)) {
                currentDepth = -depthVal;
            }
            
            for (let i = 0; i <= numPasses; i++) {
                let radius = inner + i * stepOver;
                if (radius > outer) {
                    radius = outer;
                }
                
                // Generate points along the remaining circle
                const numPoints = 50;
                const angleStep = (remainEnd - remainStart) / (numPoints - 1);
                
                // Add move to start point
                points.push(new THREE.Vector3(
                    radius * Math.cos(remainStart),
                    radius * Math.sin(remainStart),
                    5 // Safe Z height
                ));
                
                // Add plunge to cutting depth
                points.push(new THREE.Vector3(
                    radius * Math.cos(remainStart),
                    radius * Math.sin(remainStart),
                    currentDepth
                ));
                
                // Add arc points for remaining circle
                for (let j = 0; j < numPoints; j++) {
                    const angle = remainStart + j * angleStep;
                    const x = radius * Math.cos(angle);
                    const y = radius * Math.sin(angle);
                    points.push(new THREE.Vector3(x, y, currentDepth));
                }
                
                // Retract after cut
                points.push(new THREE.Vector3(
                    radius * Math.cos(remainEnd),
                    radius * Math.sin(remainEnd),
                    5 // Safe Z height
                ));
            }
        }
        
        // Create the cutting path
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            linewidth: 2
        });
        line3D = new THREE.Line(geometry, material);
        scene.add(line3D);
    }

    function animateCamera(targetPosition, targetUp) {
        if (!camera || !controls) return;
        
        const startPosition = camera.position.clone();
        const startUp = camera.up.clone();
        const duration = 1000;
        const startTime = Date.now();
        
        function update() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Cubic easing
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
            camera.up.lerpVectors(startUp, targetUp, easeProgress);
            camera.lookAt(0, 0, 0);
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                controls.update();
            }
        }
        
        update();
    }

    function addAxisLabels() {
        const addAxisLabel = (text, position, color = 0x000000) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 64;
            canvas.height = 32;
            
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.font = 'bold 24px Arial';
            context.fillStyle = '#000000';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width/2, canvas.height/2);
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(material);
            sprite.position.copy(position);
            sprite.scale.set(2, 1, 1);
            scene.add(sprite);
        };
        
        addAxisLabel('X+', new THREE.Vector3(11, 0, 0));
        addAxisLabel('X-', new THREE.Vector3(-11, 0, 0));
        addAxisLabel('Y+', new THREE.Vector3(0, 11, 0));
        addAxisLabel('Y-', new THREE.Vector3(0, -11, 0));
        addAxisLabel('Z+', new THREE.Vector3(0, 0, 11));
        addAxisLabel('Z-', new THREE.Vector3(0, 0, -11));
    }

    function addPointLabel(text, position, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 32;
        
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.font = 'bold 20px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width/2, canvas.height/2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.position.y += 1; // Offset label above the point
        sprite.scale.set(2, 0.5, 1);
        scene.add(sprite);
    }

    function onWindowResize() {
        if (camera && renderer) {
            camera.aspect = visualization3d.offsetWidth / visualization3d.offsetHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(visualization3d.offsetWidth, visualization3d.offsetHeight);
        }
    }
})(); 