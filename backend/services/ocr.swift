import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    print("Error: Missing image path argument")
    exit(1)
}

let imagePath = CommandLine.arguments[1]
let imageUrl = URL(fileURLWithPath: imagePath)

guard let image = NSImage(contentsOf: imageUrl),
      let tiffData = image.tiffRepresentation,
      let cgImage = NSBitmapImageRep(data: tiffData)?.cgImage else {
    print("Error: Could not load image at \(imagePath)")
    exit(1)
}

let requestHandler = VNImageRequestHandler(cgImage: cgImage, options: [:])
let request = VNRecognizeTextRequest { (request, error) in
    guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
    let recognizedStrings = observations.compactMap { observation in
        observation.topCandidates(1).first?.string
    }
    print(recognizedStrings.joined(separator: "\n"))
}

request.recognitionLevel = .accurate

do {
    try requestHandler.perform([request])
} catch {
    print("Error: VNImageRequestHandler failed: \(error)")
    exit(1)
}
