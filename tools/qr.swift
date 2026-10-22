import CoreImage
import CoreImage.CIFilterBuiltins
import ImageIO
import UniformTypeIdentifiers
import Foundation

let args = CommandLine.arguments
if args.count > 2 && args[1] == "--read" {
  let ctx = CIContext()
  let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: ctx, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
  for path in args.dropFirst(2) {
    let found = CIImage(contentsOf: URL(fileURLWithPath: path)).map { detector.features(in: $0).compactMap { ($0 as? CIQRCodeFeature)?.messageString } } ?? []
    let data = try! JSONSerialization.data(withJSONObject: ["file": path, "found": found])
    print(String(data: data, encoding: .utf8)!)
  }
  exit(0)
}
guard args.count == 3 else {
  FileHandle.standardError.write("usage: swift tools/qr.swift <url> <out.png> | --read <png>...\n".data(using: .utf8)!)
  exit(2)
}
let text = args[1], out = args[2]
let f = CIFilter.qrCodeGenerator()
f.message = Data(text.utf8)
f.correctionLevel = "M"
let scaled = f.outputImage!.transformed(by: CGAffineTransform(scaleX: 24, y: 24))
let ctx = CIContext()
let cg = ctx.createCGImage(scaled, from: scaled.extent)!
let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: out) as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, cg, nil)
CGImageDestinationFinalize(dest)

let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: ctx, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
let check = CIImage(contentsOf: URL(fileURLWithPath: out))!
let found = detector.features(in: check).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
guard found == [text] else {
  FileHandle.standardError.write("QR check failed: decoded \(found)\n".data(using: .utf8)!)
  exit(1)
}
print("QR ok:", text)
