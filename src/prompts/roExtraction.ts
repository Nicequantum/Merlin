export const RO_EXTRACTION_PROMPT = `Use OCR to carefully analyze the provided repair order image(s). Extract ACCURATELY and ONLY from the FIRST BLOCK (top header / primary vehicle info section — ignore labor, parts, totals, signatures, lower notes).

STRICT FIELD LOCATIONS FOR THIS MERCEDES-BENZ RO FORMAT:
- RO Number: top center of page (near "RO #", "Repair Order", "Work Order")
- Customer Name: top left customer section
- Year / Make / Model: specific vehicle information table row
- VIN: the VIN field (must be exactly 17 characters)
- Mileage IN: the "MILEAGE IN / OUT" or mileage column (numbers only)

Customer Complaints (MOST IMPORTANT - SUPER AGGRESSIVE):
Search the ENTIRE document (all pages/images) for ANY text after or under these EXACT trigger phrases (case insensitive):
"Customer states", "Customer complaint", "Customer concern", "customer states that",
"Technician notes", "Tech notes", "Technician found", "Technician observed", "Technician seen", "tech found", "tech observed", "technician notes",
"Concern", "Complaint", "Issue", "Problem", "Needs", "Requires", "state inspection", "found", "observed", "reported", "requires repair", "inspection result", "c/s", "c s".
Extract the full following text as complaints. Label them A, B, C, D etc (use form labels if present, or assign sequentially). Pull EVERY complaint from any page. If none, output exactly "None listed."

Output ONLY this exact format, nothing else:

RO Number: [precise value from top center]
Customer Name: [value]
Year: [value]
Make: [value]
Model: [value]
VIN: [exact 17 char]
Mileage IN: [numbers only]
Customer Complaints:
A. [exact text]
B. [exact text]
...

Be extremely precise on VIN (17 alphanum, fix O/0 I/1), mileage numbers, RO number. Use the trigger phrases above aggressively for complaints.`;