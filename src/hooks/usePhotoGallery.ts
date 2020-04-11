import { useState, useEffect } from 'react'
import { useCamera } from '@ionic/react-hooks/camera'
import { useFilesystem, base64FromPath } from '@ionic/react-hooks/filesystem'
import { useStorage } from '@ionic/react-hooks/storage'
import { isPlatform } from '@ionic/react'
import { CameraResultType, CameraSource, CameraPhoto, Capacitor, 
         FilesystemDirectory } from '@capacitor/core'
   
export interface IPhoto {
    filepath: string,
    webviewPath?: string,
    base64?: string,
}

const PHOTO_STORAGE = "photos"

export function usePhotoGallery() {
    const { deleteFile, getUri, readFile, writeFile } =  useFilesystem() 
    const { getPhoto } = useCamera()
    const [photos, setPhotos] = useState<IPhoto[]>([])
    const { get, set } = useStorage()

    useEffect(
        () => {
            const loadSaved = async () => {
                const photosString = await get('photos')
                const photosInStorage = (photosString ? JSON.parse(photosString) : []) as IPhoto[]
                if (!isPlatform('hybrid')) {
                    // running on the web
                    for (let photo of photosInStorage) {
                        const file = await readFile({
                            path: photo.filepath,
                            directory: FilesystemDirectory.Data
                        })
                        photo.base64 = `data:image/jpeg;base64,${file.data}`
                    }
                }
                setPhotos(photosInStorage)
            }
            loadSaved()
        }, 
        [get, readFile]
    )

    const takePhoto = async () => {
        const cameraPhoto = await getPhoto({
            resultType: CameraResultType.Uri,
            source: CameraSource.Camera,
            quality: 100,
        })

        const fileName = new Date().getTime() + '.jpg'
        const savedFileImage = await savePicture(cameraPhoto, fileName)
        const newPhotos = [savedFileImage, ...photos]
        setPhotos(newPhotos)

        set(PHOTO_STORAGE, 
            isPlatform('hybrid') 
                ? JSON.stringify(newPhotos) 
                : JSON.stringify(newPhotos.map( p => {
                    // Don't save the base64 data, since it's already saved
                    const photoCopy = { ...p }
                    delete photoCopy.base64
                    return photoCopy
                }))
        )
    }

    const savePicture = async (photo: CameraPhoto, fileName: string) => {
        let base64Data: string;
        // "hybrid" will detect Cordove or Capacitor
        if (isPlatform('hybrid')) {
            const file = await readFile({ path: photo.path! })
            base64Data = file.data
        } else {
            base64Data = await base64FromPath(photo.webPath!)
        }
        await writeFile({
            path: fileName,
            data: base64Data,
            directory: FilesystemDirectory.Data
        })
        return getPhotoFile(photo, fileName)
    }

    const getPhotoFile = async (
            cameraPhoto: CameraPhoto, 
            fileName: string
        ): Promise<IPhoto> => {
            if (isPlatform('hybrid')) {
                // get complete filepath of photo saved:
                const fileUri = await getUri({
                    directory: FilesystemDirectory.Data,
                    path: fileName
                })
                // display the image by rewriting the 'file://' path to HTTP
                // https://ionicframework.com/docs/core-concepts/webview#file-protocol
                return {
                    filepath: fileUri.uri,
                    webviewPath: Capacitor.convertFileSrc(fileUri.uri)
                }
            } else {
                // use webPath since it's already loaded into memory
                return {
                    filepath: fileName,
                    webviewPath: cameraPhoto.webPath
                } 
            }   
    }

    return {
        photos,
        takePhoto
    }
}




