import React, { useEffect } from "react";

import { renderSkeletonImageThumbnail } from "./SkeletonComponent";
import { getDownloadURL } from "../../models";
import UrlComponentPreview from "./UrlComponentPreview";
import { PreviewComponentProps } from "../preview_component_props";

/**
 * @category Preview components
 */
export default function StorageThumbnail({
                                     name,
                                     value,
                                     property,
                                     size
                                 }: PreviewComponentProps<string>) {

    const storagePathOrDownloadUrl = value;

    if (!storagePathOrDownloadUrl) return null;

    const [url, setUrl] = React.useState<string>();

    useEffect(() => {
        let unmounted = false;
        if (property.config?.storageMeta?.storeUrl)
            setUrl(storagePathOrDownloadUrl);
        else if (storagePathOrDownloadUrl)
            getDownloadURL(storagePathOrDownloadUrl)
                .then(function(downloadURL) {
                    if (!unmounted)
                        setUrl(downloadURL);
                });
        return () => {
            unmounted = true;
        };
    }, [storagePathOrDownloadUrl]);

    return url ?
        <UrlComponentPreview name={name}
                             value={url}
                             property={property}
                             size={size}/> :
        renderSkeletonImageThumbnail(size);
}
