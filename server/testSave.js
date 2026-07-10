const db = require('./models');

async function testSave() {
    try {
        const payload = {
            origin: "Miami, FL",
            destination: "Kingston, Jamaica",
            origin_city: "Miami",
            items: [{
                item_type: "Barrel",
                sub_type: "Ship Your Own Barrel",
                quantity: "1"
            }],
            origin_lat: "25.7617",
            origin_long: "-80.1918",
            destination_lat: "17.9712",
            destination_long: "-76.7928",
        };

        const userId = 1; // Assuming user 1 exists

        // REPLICATE LOGIC FROM Controller
        const cleanOrigin = payload.origin || "";
        const cleanDestination = payload.destination || "";
        const finalItems = payload.items;
        const requestedItemTypes = finalItems.map(item => (item.sub_type || item.item_type || "").toLowerCase());

        console.log("Requested Item Types:", requestedItemTypes);

        const providers = await db.providerDetails.findAll({
            include: [
                {
                    model: db.users,
                    as: 'provider',
                    attributes: ['id'],
                    include: [{ model: db.serviceAreaRoutes, as: 'serviceArea' }]
                },
                { model: db.barrelsprices, as: 'barrelPrices' },
                { model: db.provider_shipment_item_types, as: 'shipmentItemTypes' }
            ]
        });

        console.log(`Found ${providers.length} providers`);

        let matchedProvider = null;
        const hasMatch = providers.some(providerDetail => {
            const providerUser = providerDetail.provider;
            if (!providerUser) return false;

            const isBarrelRequest = requestedItemTypes.some(t => t.toLowerCase().includes('barrel'));

            if (isBarrelRequest) {
                const hasBarrelMatch = providerDetail.barrelPrices && providerDetail.barrelPrices.some(bp => {
                    const bpTypeNormalized = (bp.type || "").toLowerCase().trim();
                    const matchesType = requestedItemTypes.some(t => {
                        const sub = t.toLowerCase();
                        if (sub.includes('request barrel drop-off') || sub.includes('drop-off barrel') || sub.includes('dropoff'))
                            return bpTypeNormalized === 'dropoff';
                        if (sub.includes('ship your own barrel') || sub.includes('own barrel'))
                            return bpTypeNormalized === 'own';
                        return false;
                    });

                    const bpOrigin = (bp.originCountry || "").toLowerCase().trim();
                    const bpDest = (bp.destinationCountry || "").toLowerCase().trim();
                    const reqOrigin = cleanOrigin.toLowerCase().trim();
                    const reqDest = cleanDestination.toLowerCase().trim();

                    const originMatch = (bpOrigin === reqOrigin);
                    const destMatch = (bpDest === reqDest);

                    console.log(`Checking Provider ${providerUser.id}: BP(${bpOrigin} -> ${bpDest}, type:${bpTypeNormalized}) vs REQ(${reqOrigin} -> ${reqDest}, matchesType:${matchesType}) -> Match: ${matchesType && originMatch && destMatch}`);

                    return matchesType && originMatch && destMatch;
                });
                if (hasBarrelMatch) {
                    matchedProvider = providerUser.id;
                    return true;
                }
            }
            return false;
        });

        if (!hasMatch) {
            console.log("No match found!");
        } else {
            console.log(`Match found for provider: ${matchedProvider}`);

            const firstItem = finalItems[0];
            const br = await db.booking_requests.create({
                userId,
                origin: cleanOrigin,
                origin_city: payload.origin_city || "",
                destination: cleanDestination,
                quantity: firstItem.quantity || 0,
                weight: firstItem.weight || 0,
                description: firstItem.description || "",
                pickup_date: new Date(),
                delivery_date: new Date(),
                dimensions: firstItem.dimensions || "",
                origin_lat: payload.origin_lat,
                origin_long: payload.origin_long,
                destination_lat: payload.destination_lat,
                destination_long: payload.destination_long,
            });
            console.log("Booking Request saved with ID:", br.id);
            console.log("Saved coordinates:", br.origin_lat, br.origin_long, br.destination_lat, br.destination_long);
        }

    } catch (error) {
        console.error("Error during test:", error);
    } finally {
        process.exit();
    }
}

testSave();
