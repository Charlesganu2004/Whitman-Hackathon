Pod::Spec.new do |s|
  s.name = 'InterviewFocus'
  s.version = '1.0.0'
  s.summary = 'Individual Screen Time controls for Interview Unlocked.'
  s.description = 'Stores opaque application selections and coordinates timed focus grants with a Device Activity extension.'
  s.author = 'Charles Ganu'
  s.homepage = 'https://github.com/Charlesganu2004/Whitman-Hackathon'
  s.license = { :type => 'Private' }
  s.source = { :git => 'https://github.com/Charlesganu2004/Whitman-Hackathon.git' }
  s.platform = :ios, '16.0'
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'DeviceActivity', 'SwiftUI'
  s.source_files = '**/*.swift'
end
