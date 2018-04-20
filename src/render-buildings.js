const glsl = require('glslify')

module.exports = function createBuildingsRenderer(regl, positionsBuffer, barysBuffer, randomsBuffer, stateIndexesBuffer, settings) {
  const renderBuildings = regl({
    vert: glsl`
      attribute vec3 position;
      attribute vec3 bary;
      attribute float random;
      attribute vec2 stateIndex;

      varying vec4 fragColor;
      varying vec3 barycentric;
      varying float cameraDistance;

      uniform sampler2D buildingState;
      uniform mat4 projection;
      uniform mat4 view;

      float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
      }

      void main() {
        gl_PointSize = 1.5;
        barycentric = bary;

        vec4 color = texture2D(buildingState, stateIndex);

        gl_Position = projection * view * vec4(position.xyz, 1);
        cameraDistance = gl_Position.z;
        fragColor = color;
      }
    `,
    frag: glsl`
      #extension GL_OES_standard_derivatives : enable

      precision highp float;
      varying vec4 fragColor;
      varying vec3 barycentric;
      varying float cameraDistance;

      uniform float wireframeDistanceThreshold;
      uniform float thickness;
      uniform float opacity;
      uniform bool isLoading;

      float aastep (float threshold, float dist) {
        float afwidth = fwidth(dist) * 0.5;
        return smoothstep(threshold - afwidth, threshold + afwidth, dist);
      }

      void main() {
        if (isLoading) {
          gl_FragColor = fragColor;
          return;
        }

        float d = min(min(barycentric.x, barycentric.y), barycentric.z);
        float positionAlong = max(barycentric.x, barycentric.y);
        if (barycentric.y < barycentric.x && barycentric.y < barycentric.z) {
          positionAlong = 1.0 - positionAlong;
        }
        if (thickness == 0.0) {
          gl_FragColor = fragColor;
          gl_FragColor.a *= opacity;
        } else {
          float computedThickness = thickness;
          computedThickness *= mix(0.4, 1.0, (1.0 - sin(positionAlong * 3.1415)));
          float multiplier = 1.0 - clamp(cameraDistance, 0.0, wireframeDistanceThreshold) / wireframeDistanceThreshold;
          float edge = (1.0 - aastep(computedThickness, d)) * multiplier;
          gl_FragColor = mix(fragColor, vec4(0.18, 0.18, 0.18, 1.0), edge);
          gl_FragColor.a *= mix(opacity, 1.0, pow(edge, 1.5));
        }
      }
    `,
    uniforms: {
      wireframeDistanceThreshold: () => settings.wireframeDistanceThreshold,
      thickness: () => settings.wireframeThickness,
      opacity: () => settings.opacity
    },
    attributes: {
      position: positionsBuffer,
      stateIndex: stateIndexesBuffer,
      bary: barysBuffer,
      random: randomsBuffer
    },
    cull: {
      enable: true,
      face: 'back'
    },
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      }
    },
    count: regl.prop('count'),
    primitive: regl.prop('primitive') // 'triangles'
  })

  return function render({ primitive, countMultiplier }) {
    renderBuildings({
      primitive,
      count: (positionsBuffer._buffer.byteLength / 4 / 3 * countMultiplier) | 0
    })
  }
}
