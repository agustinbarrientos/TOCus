import {
	BackSide, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, HemisphereLight,
	Mesh, ShaderMaterial, SphereGeometry, Vector3, Vector4,
} from 'three';
import { WaterMotion, type RiversideEnvironment } from './types';

const SkyColor = `
vec3 skyColor(vec3 direction) {
	float altitude = max(direction.y, 0.0);
	vec3 horizon = vec3(0.72, 0.46, 0.31);
	vec3 zenith = vec3(0.31, 0.37, 0.49);
	vec3 color = mix(horizon, zenith, smoothstep(0.0, 0.72, altitude));
	float cloud = sin(direction.x * 5.0 + direction.y * 17.0) * sin(direction.z * 11.0 - direction.y * 13.0);
	color += 0.027 * smoothstep(0.1, 0.8, cloud) * smoothstep(0.02, 0.3, altitude);
	return color;
}`;

const WaveFunction = `
uniform float time;
uniform vec4 ripples[4];
float heightAt(vec2 p) {
	float phase = time * 1.04719755;
	float shore = 1.5 + .08 * p.x + .8 * sin(.17 * p.x) + .12 * sin(.65 * p.x);
	float fade = smoothstep(${ WaterMotion.FADE_START.toFixed( 3 ) }, ${ WaterMotion.FADE_END.toFixed( 3 ) }, -p.y - shore);
	float wave = .55 * sin(.5 * p.x - 2.6 * p.y + phase)
		+ .30 * sin(-1.25 * p.x - 3.4 * p.y + 2.0 * phase + 1.2)
		+ .15 * sin(.65 * p.x - 1.3 * p.y + phase + 2.1);
	float height = wave * ${ WaterMotion.AMPLITUDE.toFixed( 3 ) } * fade;
	for (int i=0; i<4; i++) {
		float age = time - ripples[i].z;
		if (ripples[i].w < .5 || age < 0.0 || age > 8.0) continue;
		float distance = length(p - ripples[i].xy);
		float envelope = exp(-pow((distance - age * 1.8) * 2.4, 2.0));
		height += sin(distance * 15.0 - age * 12.0) * envelope * .045 * exp(-age * .6) * step(0.0, age) * ripples[i].w;
	}
	return height;
}`;

/**
 * Builds a shoreline strip with dense nearby waves and very sparse distant water.
 * @return Geometry covering only the visible side of the bank.
 */
function waterGeometry(): BufferGeometry {
	const xs = [ -350, -120, -60, -30 ];
	for ( let x = -24; x <= 24; x += 0.6 ) {
		xs.push( x );
	}
	xs.push( 30, 60, 120, 350 );
	const rows = [
		0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3, 3.4,
		3.8, 4.2, 4.6, 5, 5.5, 6, 7, 8, 10, 13, 17, 23, 32, 50, 90, 160, 350, 650,
	];
	const vertices: number[] = [];
	const indices: number[] = [];
	for ( const distance of rows ) {
		for ( const x of xs ) {
			const shore = 1.5 + 0.08 * x + 0.8 * Math.sin( 0.17 * x ) + 0.12 * Math.sin( 0.65 * x );
			const lateralMargin = Math.min( 24, Math.max( 0, Math.abs( x ) - 7 ) * 3 );
			vertices.push( x, WaterMotion.BASE_HEIGHT, -( shore - 1.3 - lateralMargin + distance ) );
		}
	}
	for ( let row = 0; row < rows.length - 1; row++ ) {
		for ( let column = 0; column < xs.length - 1; column++ ) {
			const a = row * xs.length + column;
			const b = a + xs.length;
			indices.push( a, a + 1, b, a + 1, b + 1, b );
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute( 'position', new Float32BufferAttribute( vertices, 3 ) );
	geometry.setIndex( indices );
	geometry.computeVertexNormals();
	return geometry;
}

/**
 * Creates an inexpensive sky, animated water and one warm shadow-casting sun.
 * @return Owned scene objects and water controls.
 * @since 1.0.0
 */
export function createEnvironment(): RiversideEnvironment {
	const sky = new Mesh( new SphereGeometry( 900, 24, 12 ), new ShaderMaterial( {
		side: BackSide, depthWrite: false,
		vertexShader: 'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
		fragmentShader: `varying vec3 direction; ${ SkyColor }
		void main(){gl_FragColor=vec4(skyColor(normalize(direction)),1.0);
		#include <tonemapping_fragment>
		#include <colorspace_fragment>
		}`,
	} ) );
	sky.frustumCulled = false;
	const time = { value: 0 };
	const ripples = Array.from( { length: 4 }, () => new Vector4( 0, 0, -100, 0 ) );
	const water = new ShaderMaterial( {
		uniforms: {
			time,
			ripples: { value: ripples },
			sunDirection: { value: new Vector3( -0.45, 0.3, 0.84 ).normalize() },
		},
		vertexShader: `${ WaveFunction }
		varying vec3 worldPosition;
		void main(){vec3 p=position; p.y+=heightAt(p.xz);worldPosition=(modelMatrix*vec4(p,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(worldPosition,1.0);}`,
		fragmentShader: `${ SkyColor } ${ WaveFunction }
		uniform vec3 sunDirection;
		varying vec3 worldPosition;
		void main(){
			vec2 p=worldPosition.xz;
			float distanceToCamera=length(cameraPosition-worldPosition);
			float detail=1.0-smoothstep(.04,.25,length(fwidth(p)));
			float dx=(heightAt(p+vec2(.04,0.0))-heightAt(p-vec2(.04,0.0)))/.08;
			float dz=(heightAt(p+vec2(0.0,.04))-heightAt(p-vec2(0.0,.04)))/.08;
			dx+=detail*(.035*sin(p.x*7.0+p.y*17.0+time*1.4)+.012*sin(p.x*25.0-p.y*31.0-time));
			dz+=detail*(.045*sin(p.x*9.0+p.y*19.0+time*1.2)+.012*sin(p.x*21.0-p.y*24.0+time));
			float distanceFade=1.0-smoothstep(20.0,180.0,distanceToCamera);
			float swellDetail=1.0-smoothstep(.15,1.4,length(fwidth(p)));
			dx*=distanceFade*swellDetail*.65;dz*=distanceFade*swellDetail*.65;
			vec3 n=normalize(vec3(-dx,1.0,-dz));
			vec3 viewDirection=normalize(cameraPosition-worldPosition);
			vec3 reflected=reflect(-viewDirection,n);
			float fresnel=.18+.82*pow(1.0-max(dot(viewDirection,n),0.0),3.0);
			vec3 waterColor=mix(vec3(.20,.28,.30),skyColor(reflected),fresnel);
			float glint=pow(max(dot(reflected,sunDirection),0.0),90.0);
			waterColor+=vec3(1.0,.65,.29)*glint*.9;
			waterColor+=detail*.008*sin(p.y*36.0+p.x*3.0+time)*(1.0-smoothstep(2.0,15.0,distanceToCamera));
			waterColor=mix(waterColor,skyColor(vec3(0.0,0.0,-1.0)),smoothstep(70.0,400.0,distanceToCamera));
			if(abs(p.x)<1.35 && abs(p.y+1.5)<.85){
				for(int foot=0;foot<2;foot++){
					vec2 center=vec2(foot==0?-.604:.615,-1.496);
					float contact=smoothstep(.091,.16,${ WaterMotion.BASE_HEIGHT.toFixed( 3 ) }+heightAt(center));
					vec2 offset=(p-center)*vec2(1.0,.8);
					float ring=1.0-smoothstep(.018,.075,abs(length(offset)-(.25+.055*sin(time*2.1))));
					float broken=.5+.5*sin(p.x*28.0+p.y*19.0-time*3.0);
					waterColor=mix(waterColor,vec3(.87,.79,.64),contact*ring*broken*.45);
				}
			}
			gl_FragColor=vec4(waterColor,1.0);
			#include <tonemapping_fragment>
			#include <colorspace_fragment>
		}`,
	} );
	const river = new Mesh( waterGeometry(), water );
	river.name = 'Visible shoreline water';
	const hemisphere = new HemisphereLight( new Color( '#e4e8f7' ), new Color( '#b77c4d' ), 2 );
	const sun = new DirectionalLight( '#ffce92', 3.2 );
	sun.position.set( -6, 7, 10 );
	sun.target.position.set( 0, 1, 0 );
	sun.castShadow = true;
	sun.shadow.mapSize.set( 1024, 1024 );
	sun.shadow.camera.left = -15;
	sun.shadow.camera.right = 15;
	sun.shadow.camera.top = 14;
	sun.shadow.camera.bottom = -12;
	sun.shadow.camera.far = 60;
	sun.shadow.bias = -0.0003;
	sun.shadow.normalBias = 0.04;
	sun.shadow.radius = 3;
	const fill = new DirectionalLight( '#d6e4ff', 0.7 );
	fill.position.set( 6, 8, -5 );
	return { objects: [ sky, river, hemisphere, sun, sun.target, fill ], water, time, ripples };
}
