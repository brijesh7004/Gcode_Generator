// Wrap the code in an IIFE to prevent direct access to variables
(function() {
    let currentScale = 2;
    const minScale = 0.5;
    const maxScale = 10;
    let scene, camera, renderer, controls, line3D;
    let isSceneInitialized = false;
    let generatedGcode = '';
    
    // Get DOM elements
    const canvas = document.getElementById('visualization');
    const ctx = canvas.getContext('2d');
    const generateBtn = document.getElementById('generateBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');
    const view2DBtn = document.getElementById('view2D');
    const view3DBtn = document.getElementById('view3D');
    const visualization3d = document.getElementById('visualization3d');
    const viewAngles = document.getElementById('viewAngles');
    const gcodeOutput = document.getElementById('gcodeOutput');
    
    // Input elements
    const travelStart = document.getElementById('travelStart');
    const travelEnd = document.getElementById('travelEnd');
    const depthStart = document.getElementById('depthStart');
    const depthEnd = document.getElementById('depthEnd');
    const depthStep = document.getElementById('depthStep');
    const zBase = document.getElementById('zBase');
    const toolDiameter = document.getElementById('toolDiameter');
    const toolSpeed = document.getElementById('toolSpeed');
    const feedrateDrill = document.getElementById('feedrateDrill');
    const feedrateTravel = document.getElementById('feedrateTravel');
    const direction = document.getElementById('direction');
    
    // Initialize canvas size
    function resizeCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        drawVisualization();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Draw grid
    function drawGrid(ctx) {
        const gridSize = 10;
        const gridStep = 10;
        
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 0.5;
        
        // Draw vertical lines
        for (let x = -gridSize * gridStep; x <= gridSize * gridStep; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, -gridSize * gridStep);
            ctx.lineTo(x, gridSize * gridStep);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = -gridSize * gridStep; y <= gridSize * gridStep; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(-gridSize * gridStep, y);
            ctx.lineTo(gridSize * gridStep, y);
            ctx.stroke();
        }
        
        // Draw axes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        
        // X axis
        ctx.beginPath();
        ctx.moveTo(-gridSize * gridStep, 0);
        ctx.lineTo(gridSize * gridStep, 0);
        ctx.stroke();
        
        // Y axis
        ctx.beginPath();
        ctx.moveTo(0, -gridSize * gridStep);
        ctx.lineTo(0, gridSize * gridStep);
        ctx.stroke();
    }
    
    // Draw visualization
    function drawVisualization() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        
        // Move to center and scale
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(currentScale, currentScale);
        
        // Draw grid
        drawGrid(ctx);
        
        // Get parameters
        const start = parseFloat(travelStart.value);
        const end = parseFloat(travelEnd.value);
        const depth = parseFloat(depthEnd.value);
        const isXAxis = direction.value === 'X';
        
        // Draw cutting path
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        if (isXAxis) {
            ctx.moveTo(start, 0);
            ctx.lineTo(end, 0);
        } else {
            ctx.moveTo(0, start);
            ctx.lineTo(0, end);
        }
        ctx.stroke();
        
        // Draw direction arrow
        const arrowSize = 2;
        const midPoint = (start + end) / 2;
        
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        if (isXAxis) {
            ctx.moveTo(midPoint, 0);
            ctx.lineTo(midPoint + arrowSize, -arrowSize);
            ctx.lineTo(midPoint + arrowSize, arrowSize);
        } else {
            ctx.moveTo(0, midPoint);
            ctx.lineTo(-arrowSize, midPoint + arrowSize);
            ctx.lineTo(arrowSize, midPoint + arrowSize);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
    
    // Add input change listeners for real-time updates
    [travelStart, travelEnd, depthStart, depthEnd, depthStep, zBase, 
     toolDiameter, toolSpeed, feedrateDrill, feedrateTravel, direction].forEach(input => {
        input.addEventListener('input', () => {
            drawVisualization();
            if (visualization3d.classList.contains('canvas-active')) {
                update3DVisualization();
            }
        });
    });
    
    // Generate G-code
    function generateGCode() {
        const start = parseFloat(travelStart.value);
        const end = parseFloat(travelEnd.value);
        const depthStartVal = parseFloat(depthStart.value);
        const depthEndVal = parseFloat(depthEnd.value);
        const stepVal = parseFloat(depthStep.value);
        const zBaseVal = parseFloat(zBase.value);
        const speedVal = parseFloat(toolSpeed.value);
        const feedDrill = parseFloat(feedrateDrill.value);
        const feedTravel = parseFloat(feedrateTravel.value);
        const isXAxis = direction.value === 'X';
        
        const gcode = [];
        const format = (num) => num.toFixed(6);
        
        // Initial setup
        gcode.push('G21');
        gcode.push('G90');
        gcode.push('G94');
        gcode.push('');
        
        // Set initial feedrate and move to start position
        gcode.push(`F${format(feedTravel)}`);
        if (isXAxis) {
            gcode.push(`G0 X${format(start)} Y0.000000`);
        } else {
            gcode.push(`G0 X0.000000 Y${format(start)}`);
        }
        gcode.push(`G0 Z${format(zBaseVal)}`);
        gcode.push('');
        
        // Start spindle and set cutting feedrate
        gcode.push('M03');
        gcode.push(`G01 F${format(feedDrill)}`);
        gcode.push('');
        
        // Move to initial Z0 position
        gcode.push('G01 Z0.000000');
        if (isXAxis) {
            gcode.push(`G01 X${format(end)} Y0.000000`);
        } else {
            gcode.push(`G01 X0.000000 Y${format(end)}`);
        }
        
        // Calculate depth passes
        let currentDepth = 0;
        while (currentDepth < depthEndVal) {
            currentDepth = Math.min(currentDepth + stepVal, depthEndVal);
            
            // Move to next depth
            gcode.push('');
            gcode.push(`G01 Z${format(currentDepth)}`);
            
            // Move to start position
            if (isXAxis) {
                gcode.push(`G01 X${format(start)} Y0.000000`);
            } else {
                gcode.push(`G01 X0.000000 Y${format(start)}`);
            }
            
            if (currentDepth < depthEndVal) {
                // Move to next depth
                gcode.push('');
                gcode.push(`G01 Z${format(currentDepth)}`);
                
                // Move to end position
                if (isXAxis) {
                    gcode.push(`G01 X${format(end)} Y0.000000`);
                } else {
                    gcode.push(`G01 X0.000000 Y${format(end)}`);
                }
            }
        }
        
        // Final depth move
        gcode.push('');
        gcode.push(`G01 Z${format(zBaseVal)}`);
        gcode.push('');
        
        // End program
        gcode.push(`F${format(feedTravel)}`);
        gcode.push('M05');
        if (isXAxis) {
            gcode.push(`G00 X${format(start)} Y0.000000`);
        } else {
            gcode.push(`G00 X0.000000 Y${format(start)}`);
        }
        
        generatedGcode = gcode.join('\n');
        gcodeOutput.textContent = generatedGcode;
        
        // Update visualization
        drawVisualization();
        if (visualization3d.classList.contains('canvas-active')) {
            update3DVisualization();
        }
    }
    
    // Download G-code
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
        a.download = `linear_line_${timestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Reset parameters
    function reset() {
        travelStart.value = '0';
        travelEnd.value = '10';
        depthStart.value = '0';
        depthEnd.value = '5';
        depthStep.value = '0.2';
        zBase.value = '-5';
        toolDiameter.value = '3';
        toolSpeed.value = '1000';
        feedrateDrill.value = '100';
        feedrateTravel.value = '1000';
        direction.value = 'X';
        
        currentScale = 2;
        drawVisualization();
        if (visualization3d.classList.contains('canvas-active')) {
            update3DVisualization();
        }
        gcodeOutput.textContent = 'Generated G-code will appear here...';
    }
    
    // 3D Visualization
    function init3DScene() {
        if (!isSceneInitialized) {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000000);
            
            camera = new THREE.PerspectiveCamera(
                60,
                visualization3d.clientWidth / visualization3d.clientHeight,
                0.1,
                1000
            );
            
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(visualization3d.clientWidth, visualization3d.clientHeight);
            visualization3d.innerHTML = '';
            visualization3d.appendChild(renderer.domElement);
            
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            
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
            gridHelper.rotation.x = Math.PI / 2;
            scene.add(gridHelper);
            
            // Add axes
            const axesHelper = new THREE.AxesHelper(20);
            scene.add(axesHelper);
            
            function animate() {
                requestAnimationFrame(animate);
                controls.update();
                renderer.render(scene, camera);
            }
            animate();
            
            window.addEventListener('resize', onWindowResize, false);
            
            isSceneInitialized = true;
        }
    }
    
    function update3DVisualization() {
        if (!isSceneInitialized) {
            init3DScene();
        }
        
        // Remove existing line
        if (line3D) scene.remove(line3D);
        
        const start = parseFloat(travelStart.value);
        const end = parseFloat(travelEnd.value);
        const depthStartVal = parseFloat(depthStart.value);
        const depthEndVal = parseFloat(depthEnd.value);
        const stepVal = parseFloat(depthStep.value);
        const isXAxis = direction.value === 'X';
        
        const points = [];
        const numPasses = Math.ceil(Math.abs(depthEndVal - depthStartVal) / stepVal);
        
        // Add initial position
        points.push(new THREE.Vector3(
            isXAxis ? start : 0,
            isXAxis ? 0 : start,
            5
        ));
        
        for (let pass = 0; pass <= numPasses; pass++) {
            const currentDepth = depthStartVal - (pass * stepVal);
            const finalDepth = Math.max(currentDepth, -Math.abs(depthEndVal));
            
            // Move to start position
            points.push(new THREE.Vector3(
                isXAxis ? start : 0,
                isXAxis ? 0 : start,
                5
            ));
            
            // Plunge
            points.push(new THREE.Vector3(
                isXAxis ? start : 0,
                isXAxis ? 0 : start,
                finalDepth
            ));
            
            // Cut to end
            points.push(new THREE.Vector3(
                isXAxis ? end : 0,
                isXAxis ? 0 : end,
                finalDepth
            ));
            
            // Retract
            points.push(new THREE.Vector3(
                isXAxis ? end : 0,
                isXAxis ? 0 : end,
                5
            ));
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            linewidth: 2
        });
        line3D = new THREE.Line(geometry, material);
        scene.add(line3D);
        
        // Update renderer
        if (renderer) {
            renderer.render(scene, camera);
        }
    }
    
    function onWindowResize() {
        if (camera && renderer) {
            camera.aspect = visualization3d.clientWidth / visualization3d.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(visualization3d.clientWidth, visualization3d.clientHeight);
        }
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
    
    // Event listeners
    generateBtn.addEventListener('click', generateGCode);
    downloadBtn.addEventListener('click', downloadGCode);
    resetBtn.addEventListener('click', reset);
    
    // View toggle handlers
    view2DBtn.addEventListener('click', () => {
        view2DBtn.classList.add('active');
        view3DBtn.classList.remove('active');
        canvas.classList.add('canvas-active');
        canvas.classList.remove('canvas-hidden');
        visualization3d.classList.add('canvas-hidden');
        visualization3d.classList.remove('canvas-active');
        viewAngles.style.display = 'none';
        drawVisualization();
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
    document.getElementById('topViewBtn').addEventListener('click', () => {
        animateCamera(
            new THREE.Vector3(0, 0, 40),
            new THREE.Vector3(0, 1, 0)
        );
    });
    
    document.getElementById('side1ViewBtn').addEventListener('click', () => {
        animateCamera(
            new THREE.Vector3(40, 0, 0),
            new THREE.Vector3(0, 0, 1)
        );
    });
    
    document.getElementById('side2ViewBtn').addEventListener('click', () => {
        animateCamera(
            new THREE.Vector3(0, 40, 0),
            new THREE.Vector3(0, 0, 1)
        );
    });
    
    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', () => {
        currentScale = Math.min(currentScale * 1.2, maxScale);
        drawVisualization();
    });
    
    document.getElementById('zoomOut').addEventListener('click', () => {
        currentScale = Math.max(currentScale / 1.2, minScale);
        drawVisualization();
    });
    
    document.getElementById('resetZoom').addEventListener('click', () => {
        currentScale = 2;
        drawVisualization();
    });
    
    // Initialize visualization
    drawVisualization();
})();

// Obfuscate the code
const obfuscatedCode = JavaScriptObfuscator.obfuscate(`
    // Your entire code here
`, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    numbersToExpressions: true,
    simplify: true,
    stringArrayShuffle: true,
    splitStrings: true,
    stringArrayThreshold: 1
}).getObfuscatedCode(); 