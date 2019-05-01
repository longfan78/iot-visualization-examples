import Controller from "./Controller";
import Inspector from "./Inspector";
import "three/examples/js/controls/OrbitControls.js";
import "three/examples/js/loaders/GLTFLoader.js";

// outline
import "three/examples/js/shaders/CopyShader.js";
import "three/examples/js/shaders/FXAAShader.js";
import "three/examples/js/postprocessing/EffectComposer.js";
import "three/examples/js/postprocessing/RenderPass.js";
import "three/examples/js/postprocessing/ShaderPass.js";
import "./outlinepass.js";

import { 
	WebGLRenderer, 
	Raycaster,
	Scene
} from "three";

const THREE = (<windowEx>window).THREE;

interface options{
	renderder?:any;
	inspector?:boolean;
	orbit?:boolean;
}

class Space {
	animateActionMap:Map<string,Function>;
	camera:any;
	composer:any;
	readonly element:Element;
	innerHeight:number;
	innerWidth:number;
	mouse:any;
	offset:{
		top:number;
		left:number;
	};
	readonly options:options;
	orbit:any;
	outlinePass:any;
	raycaster:Raycaster;
	raycasterEventMap:Map<string,Function>;
	raycasterObjects:Object3dEx[];
	raycasterRecursive:boolean;
	renderer:WebGLRenderer;
	scene:Scene;
	private _eventList:any;

	constructor(element:Element,options?:options){
		this.element = element;
		this.options = options;
		this.init();
		return this;
	}


	addAnimateAction(key:string,func:Function):Space{
		const map = this.animateActionMap;
		if(map.has(key)){
			console.warn(`${key} already existed in animateActionMap,and replace by new function.`);
		}
		map.set(key,func);
		return this;
	}

	afterLoaded():Space{
		const e = this.element;
		// all object is raycaster by default.
		this.raycasterObjects=[];
		this.scene.traverse((object3d:Object3dEx)=>{
			this.raycasterObjects.push(object3d);
			new Controller(this,object3d);

		});
		// click: outline the object by default.
		if(!this.raycasterEventMap){
			this.setraycasterEventMap({
				click:(intersects:any)=>{
					this.setOutline([intersects[0].object]);
				}
			});
		}
		e.addEventListener('click', this._eventList.updateMouse);
		e.addEventListener("dblclick",this._eventList.updateMouse);
		e.addEventListener("mousemove",this._eventList.updateMouse);
		this.initOutline();
		this.animate();
		return this;
	}
	animate():Space{

		this.animateActionMap.forEach((func:Function)=>{
			func();
		})

		if(this.composer){
			this.composer.render();
		}
		else{
			this.renderer.render( this.scene, this.camera );
		}

		requestAnimationFrame( this.animate.bind(this) );
		return this;
	}

	autoRotate(flag:boolean,speed?:number){
		const orbit = this.orbit
		if(!orbit){
			return console.error("autoRotate need orbit control");
		}
		orbit.autoRotate = flag;

		if(flag){
			orbit.autoRotateSpeed = speed || 2;			
			this.addAnimateAction('autoRotate',()=>{
				orbit.update();
			})
		}
		else{
			this.removeAnimateAction('autoRotate');
		}
	}

	dispose(){
		const e = this.element;
		// TODO: dispose Materials,Geometries,Textures,Render Targets

		// @ts-ignore : scene has dispose method.
		this.scene.dispose();

		window.removeEventListener('resize', this._eventList.resize);
		e.removeEventListener('click', this._eventList.updateMouse);
		e.removeEventListener("dblclick",this._eventList.updateMouse);
		e.removeEventListener("mousemove",this._eventList.updateMouse);
		this._eventList = null;
	}
	
	init():Space{
		const e = this.element;
		const options = this.options || {};
		const renderer = this.renderer = new THREE.WebGLRenderer({alpha:true});

		if(e.clientWidth === 0 || e.clientHeight === 0){
			console.error("element should had width and height before init.");
			return this;
		}

		this.innerWidth =  e.clientWidth;
		this.innerHeight =  e.clientHeight;
		this.animateActionMap = new Map();
		this.offset = $(e).offset();

		renderer.setSize(e.clientWidth, e.clientHeight );
		e.appendChild(renderer.domElement);

		this.raycaster = new THREE.Raycaster();
		this.mouse = new THREE.Vector2();

		if(options.inspector){
			const inspector = new Inspector(this);
			this.addAnimateAction("inspector",inspector.animateAction);
			this.setraycasterEventMap(inspector.raycasterEvent);
		}

		this._eventList={
			resize:this.resize.bind(this),
			updateMouse:this.updateMouse.bind(this)
		}

		window.addEventListener('resize', this._eventList.resize);

		return this;
	}

	initOrbit():Space{
		const options = this.options || {};

		if(options.orbit){
			const orbit = this.orbit = new THREE.OrbitControls(this.camera,this.renderer.domElement);
			orbit.update();
		}

		return this;
	}

	initOutline():Space{
		const composer = new THREE.EffectComposer( this.renderer );
		this.composer = composer;

		const  renderPass = new THREE.RenderPass( this.scene, this.camera);
		composer.addPass( renderPass );

		const outlinePass = new THREE.OutlinePass( new THREE.Vector2( this.innerWidth, this.innerHeight ), this.scene, this.camera );
		composer.addPass( outlinePass );
		this.outlinePass = outlinePass;
		outlinePass.edgeStrength = 5
		outlinePass.edgeGlow = 1
		outlinePass.pulsePeriod = 2
		outlinePass.visibleEdgeColor.set('#35f2d1')
		outlinePass.hiddenEdgeColor.set('#30a0de')

		const effectFXAA = new THREE.ShaderPass( THREE.FXAAShader );
		effectFXAA.uniforms[ 'resolution' ].value.set( 1 / this.innerWidth, 1 / this.innerHeight );
		effectFXAA.renderToScreen = true;
		composer.addPass( effectFXAA );
		return this;
	}

	load(file:string):Promise<any> {
		const scope = this;
		return new Promise((resolve,reject)=>{
			// TODO: set and get data first from indexDB
			const loader = new THREE.GLTFLoader();
			loader.load(file,
				function loaded(gltf:any) {
					console.log(gltf);
					let e = scope.element;
					let scene = scope.scene = gltf.scene;
					let camera = scope.camera = new THREE.PerspectiveCamera( 20, e.clientWidth/e.clientHeight, 0.1, 1000 );
					scope.setPerspectiveCamera(camera,scene.userData);
					scene.add(camera);
					scene.add( new THREE.HemisphereLight( 0xffffff, 0xcccccc, 1 ) );
					resolve();
					scope.afterLoaded();
				},
				function progressing(xhr:any) {
					console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
					// TODO: show progressing in html
				},
				function loadedError(error:Error) {
					reject(error);
				})
		});
	}



	removeAnimateAction(key:string):Space{
		this.animateActionMap.delete(key);
		return this;
	}

	resize():Space{
		const camera = this.camera;
		const e = this.element;
		this.offset = $(e).offset(); 
		if(e.clientWidth === 0 || e.clientHeight === 0){
			console.error("resize error:element width and height is error.",e.clientWidth,e.clientHeight);
			return this;
		}

		// console.log(camera,offset);

		if(camera.type === "PerspectiveCamera"){
			camera.aspect = e.clientWidth / e.clientHeight;
			camera.updateProjectionMatrix();
		}

		this.renderer.setSize(e.clientWidth, e.clientHeight);
		return this;
	}

	raycasterAction():Space{

		if(this.raycasterEventMap.size === 0){
			return this;
		}

		const raycaster = this.raycaster;
		const mouse = this.mouse;
		const eventMap = this.raycasterEventMap;
		let intersects;
		raycaster.setFromCamera(mouse, this.camera);
		intersects = raycaster.intersectObjects(this.raycasterObjects, this.raycasterRecursive);

		if(intersects.length === 0){
			return this;
		}

		// raycasterEventMap callback
		if(eventMap.has(mouse.eventType)){
			let func = eventMap.get(mouse.eventType);
			if(func){
				func(intersects);
			}
		}
		// console.log(intersects);

		return this;
	}

	setOutline(array:Object3dEx[]){
		if(this.outlinePass){
			this.outlinePass.selectedObjects = array;
		}
	}

	setPerspectiveCamera(camera:any,data:any):Space{
		const degToRad  = THREE.Math.degToRad ;
		camera.fov = data.fov;
		camera.position.set(data.x||0,data.y||0,data.z||0)
		camera.rotation.set(degToRad(data.rx||0),degToRad(data.ry||0),degToRad(data.rz||0))
		camera.updateProjectionMatrix();
		this.initOrbit();
		return this;
	}

	setraycasterEventMap(eventList:any):Space{
		let eventMap = this.raycasterEventMap;
		if(!eventMap){
			eventMap = this.raycasterEventMap = new Map();
		}

		eventMap.set("click",eventList.click);
		eventMap.set("dblclick",eventList.dblclick);
		eventMap.set("mousemove",eventList.mousemove);
		return this;
	}

	updateMouse(event:MouseEvent):Space{
		const mouse = this.mouse;
		switch (event.type) {
			case 'click':
				mouse.eventType = 'click'
				break;

			case 'dblclick':
				mouse.eventType = 'dblclick'
				break;

			case 'mousemove':
				mouse.eventType = 'mousemove'
				break;
		
			default:
				console.error("updateMouse eventType error:",event);
				return this;
		}
		// serialize value to -1 ~ +1
		mouse.x = (event.clientX - (this.offset.left)) / this.innerWidth * 2 - 1
		mouse.y = -((event.clientY - (this.offset.top)) / this.innerHeight) * 2 + 1
		this.raycasterAction();
		return this;
	}



}

export default Space;